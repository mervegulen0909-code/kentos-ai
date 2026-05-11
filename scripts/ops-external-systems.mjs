#!/usr/bin/env node
// KentOS production external-system helper.
//
// Default mode is read-only: validate env, DNS/TLS, provider readiness, and
// docker compose state. Production deploy is available only with explicit
// --apply-deploy --i-accept-production-deploy flags.

import { spawn } from "node:child_process";
import dns from "node:dns/promises";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const options = readOptions(args);

const envFile = path.resolve(
  REPO_ROOT,
  options.envFile ?? ".env.production.local",
);
const json = flags.has("--json");
const checkNetwork = !flags.has("--skip-network");
const checkCompose = flags.has("--compose") || flags.has("--apply-deploy");
const applyDeploy = flags.has("--apply-deploy");
const deployAccepted = flags.has("--i-accept-production-deploy");
const allowLive = flags.has("--allow-live");
const allowRetentionDelete = flags.has("--allow-retention-delete");
const expectedServerIp =
  options.expectedServerIp ?? process.env.EXPECTED_SERVER_IP;

const startedAt = new Date();
const reportDir = path.join(REPO_ROOT, "output", "ops-external-systems");
const reportPath = path.join(reportDir, `ops-external-${stamp(startedAt)}.md`);
const checks = [];
const commandResults = [];

if (existsSync(envFile)) {
  const parsed = parseEnv(await readFile(envFile, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  if (!readEnv("PUBLIC_GATEWAY_BASE_URL") && readEnv("GATEWAY_DOMAIN")) {
    process.env.PUBLIC_GATEWAY_BASE_URL = `https://${readEnv("GATEWAY_DOMAIN")}`;
  }
  if (!readEnv("PUBLIC_CITIZEN_BASE_URL") && readEnv("CITIZEN_DOMAIN")) {
    process.env.PUBLIC_CITIZEN_BASE_URL = `https://${readEnv("CITIZEN_DOMAIN")}`;
  }
  addCheck({
    id: "env-file",
    status: "passed",
    summary: `Loaded env file: ${relative(envFile)}`,
    detail: "Secret values are never printed by this script.",
  });
} else {
  addCheck({
    id: "env-file",
    status: "blocked",
    summary: `Env file not found: ${relative(envFile)}`,
    detail:
      "Run pnpm infra:prod:bootstrap first, then edit the generated values.",
  });
}

addRequiredEnvChecks();
addProviderReadinessChecks();
addSafetyGateChecks();

if (checkNetwork) {
  await addDnsChecks();
  await addHttpChecks();
} else {
  addCheck({
    id: "network-skipped",
    status: "warning",
    summary: "DNS and HTTPS probes were skipped.",
    detail:
      "Re-run without --skip-network from a machine that can reach production DNS.",
  });
}

if (checkCompose) {
  await addComposeChecks();
}

if (applyDeploy) {
  if (hasBlockingChecks()) {
    addCheck({
      id: "production-deploy",
      status: "blocked",
      summary:
        "Production deploy was not started because preflight has blocking checks.",
      detail:
        "Resolve blocked/failed checks, or pass the documented approval flags where appropriate, then re-run.",
    });
  } else {
    await runProductionDeploy();
  }
}

const summary = summarize(checks);
await mkdir(reportDir, { recursive: true });
await writeFile(reportPath, renderMarkdown(summary), "utf8");

if (json) {
  console.log(
    JSON.stringify({ summary, checks, commandResults, reportPath }, null, 2),
  );
} else {
  printHuman(summary);
}

process.exit(summary.blocked > 0 || summary.failed > 0 ? 1 : 0);

function addRequiredEnvChecks() {
  const required = [
    "API_DOMAIN",
    "ADMIN_DOMAIN",
    "CITIZEN_DOMAIN",
    "GATEWAY_DOMAIN",
    "MUNICIPALITY_DOMAIN",
    "DEFAULT_TENANT_SLUG",
    "PUBLIC_API_BASE_URL",
    "PUBLIC_CITIZEN_BASE_URL",
    "DATABASE_URL",
    "REDIS_URL",
    "POSTGRES_PASSWORD",
    "REDIS_PASSWORD",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "INTERNAL_API_KEY",
    "S3_BUCKET",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "WIDGET_ORIGIN_ALLOWLIST",
  ];
  const missing = required.filter((name) => !readEnv(name));
  addCheck({
    id: "public-citizen-base-url",
    status: readEnv("PUBLIC_CITIZEN_BASE_URL") ? "passed" : "warning",
    summary: readEnv("PUBLIC_CITIZEN_BASE_URL")
      ? "PUBLIC_CITIZEN_BASE_URL is available."
      : "PUBLIC_CITIZEN_BASE_URL is missing and could not be inferred.",
    detail:
      "Admin widget install snippets use this origin for the external script URL.",
  });

  addCheck({
    id: "required-prod-env",
    status: missing.length ? "blocked" : "passed",
    summary: missing.length
      ? `Missing required production env: ${missing.join(", ")}`
      : "Required production env is present.",
    detail: "Presence-only check. Secret values are not printed.",
  });

  addCheck({
    id: "public-gateway-base-url",
    status: readEnv("PUBLIC_GATEWAY_BASE_URL") ? "passed" : "warning",
    summary: readEnv("PUBLIC_GATEWAY_BASE_URL")
      ? "PUBLIC_GATEWAY_BASE_URL is available."
      : "PUBLIC_GATEWAY_BASE_URL is missing and could not be inferred.",
    detail:
      "New env files include this value. Existing env files can set it to https://$GATEWAY_DOMAIN.",
  });

  const placeholderDomains = [
    "API_DOMAIN",
    "ADMIN_DOMAIN",
    "CITIZEN_DOMAIN",
    "GATEWAY_DOMAIN",
    "MUNICIPALITY_DOMAIN",
  ].filter((name) => readEnv(name).includes("example.com"));
  addCheck({
    id: "real-domains",
    status: placeholderDomains.length ? "blocked" : "passed",
    summary: placeholderDomains.length
      ? `Placeholder domains still configured: ${placeholderDomains.join(", ")}`
      : "Production domains are not example.com placeholders.",
    detail:
      "DNS must point to the VPS before Caddy can issue ACME certificates.",
  });
}

function addProviderReadinessChecks() {
  const aiProvider = readEnv("AI_PROVIDER") || "stub";
  const aiMissing = [];
  if (aiProvider === "anthropic") {
    if (!readEnv("ANTHROPIC_API_KEY")) aiMissing.push("ANTHROPIC_API_KEY");
    if (
      !readEnv("AI_DAILY_TOKEN_BUDGET") &&
      !readEnv("AI_DAILY_COST_BUDGET_MICROS")
    ) {
      aiMissing.push("AI_DAILY_TOKEN_BUDGET or AI_DAILY_COST_BUDGET_MICROS");
    }
  }
  addCheck({
    id: "ai-provider",
    status: aiMissing.length ? "blocked" : "passed",
    summary: aiMissing.length
      ? `AI_PROVIDER=${aiProvider} is not ready: ${aiMissing.join(", ")}`
      : `AI provider readiness satisfied for AI_PROVIDER=${aiProvider}.`,
    detail:
      aiProvider === "stub"
        ? "Stub mode performs no paid model calls."
        : "Live provider credentials and budget guard presence were checked without printing secrets.",
  });

  const emailProvider = (readEnv("EMAIL_PROVIDER") || "smtp").toLowerCase();
  const emailMissing = [];
  if (readEnv("EMAIL_OUTBOUND_LIVE") === "true") {
    if (!readEnv("EMAIL_FROM_ADDRESS")) emailMissing.push("EMAIL_FROM_ADDRESS");
    if (emailProvider === "postmark" && !readEnv("POSTMARK_SERVER_TOKEN"))
      emailMissing.push("POSTMARK_SERVER_TOKEN");
    if (emailProvider === "smtp") {
      for (const name of [
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USER",
        "SMTP_PASSWORD",
      ]) {
        if (!readEnv(name)) emailMissing.push(name);
      }
    }
  }
  for (const name of [
    "POSTMARK_INBOUND_BASIC_USER",
    "POSTMARK_INBOUND_BASIC_PASS",
    "EMAIL_DEFAULT_TENANT_ID",
  ]) {
    if (!readEnv(name)) emailMissing.push(name);
  }
  addCheck({
    id: "email-provider",
    status: emailMissing.length ? "warning" : "passed",
    summary: emailMissing.length
      ? `Email provider/inbound values need review: ${unique(emailMissing).join(", ")}`
      : `Email provider readiness satisfied for EMAIL_PROVIDER=${emailProvider}.`,
    detail: `Postmark inbound URL: ${readEnv("PUBLIC_GATEWAY_BASE_URL") || `https://${readEnv("GATEWAY_DOMAIN")}`}/webhooks/email`,
  });

  const metaMissing = [];
  if (
    readEnv("WHATSAPP_OUTBOUND_LIVE") === "true" &&
    !readEnv("META_APP_SECRET")
  )
    metaMissing.push("META_APP_SECRET");
  if (
    readEnv("INSTAGRAM_OUTBOUND_LIVE") === "true" &&
    !readEnv("INSTAGRAM_GRAPH_TOKEN")
  )
    metaMissing.push("INSTAGRAM_GRAPH_TOKEN");
  if (
    readEnv("FACEBOOK_OUTBOUND_LIVE") === "true" &&
    !readEnv("FACEBOOK_PAGE_TOKEN")
  )
    metaMissing.push("FACEBOOK_PAGE_TOKEN");
  if (readEnv("SMS_OUTBOUND_LIVE") === "true") {
    for (const name of [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_FROM_NUMBER",
    ]) {
      if (!readEnv(name)) metaMissing.push(name);
    }
  }
  addCheck({
    id: "channel-provider-credentials",
    status: metaMissing.length ? "blocked" : "passed",
    summary: metaMissing.length
      ? `Live channel provider credentials are missing: ${unique(metaMissing).join(", ")}`
      : "Live channel provider credential requirements are satisfied for enabled flags.",
    detail:
      "Disabled live outbound channels do not require provider credentials.",
  });

  const scanProvider = (
    readEnv("ATTACHMENT_SCAN_PROVIDER") || "placeholder"
  ).toLowerCase();
  const clamavMissing =
    scanProvider === "clamav"
      ? ["CLAMAV_HOST", "CLAMAV_PORT"].filter((name) => !readEnv(name))
      : [];
  addCheck({
    id: "attachment-scan",
    status: clamavMissing.length
      ? "blocked"
      : scanProvider === "clamav"
        ? "passed"
        : "warning",
    summary: clamavMissing.length
      ? `ClamAV scan provider is selected but missing: ${clamavMissing.join(", ")}`
      : scanProvider === "clamav"
        ? "Attachment scanning is configured for ClamAV."
        : `Attachment scanning is still ${scanProvider}.`,
    detail:
      scanProvider === "clamav"
        ? "Compose provides clamav:3310; use --compose on the VPS to verify container health."
        : "Switch ATTACHMENT_SCAN_PROVIDER=clamav after the ClamAV service is healthy.",
  });
}

function addSafetyGateChecks() {
  const liveFlags = [
    "WHATSAPP_OUTBOUND_LIVE",
    "INSTAGRAM_OUTBOUND_LIVE",
    "FACEBOOK_OUTBOUND_LIVE",
    "SMS_OUTBOUND_LIVE",
    "EMAIL_OUTBOUND_LIVE",
  ].filter((name) => readEnv(name) === "true");
  addCheck({
    id: "live-outbound-gate",
    status: liveFlags.length && !allowLive ? "blocked" : "passed",
    summary: liveFlags.length
      ? `Live outbound flags enabled: ${liveFlags.join(", ")}`
      : "No live outbound flags are enabled.",
    detail:
      liveFlags.length && !allowLive
        ? "Re-run with --allow-live only after operator approval is recorded."
        : "Live outbound gate is satisfied for this run mode.",
  });

  const retentionDelete =
    readEnv("RETENTION_DRY_RUN") === "false" ||
    readEnv("RETENTION_DELETE_ATTACHMENT_OBJECTS") === "true";
  addCheck({
    id: "retention-delete-gate",
    status: retentionDelete && !allowRetentionDelete ? "blocked" : "passed",
    summary: retentionDelete
      ? `Retention delete mode requested. RETENTION_DRY_RUN=${readEnv("RETENTION_DRY_RUN") || "unset"}, RETENTION_DELETE_ATTACHMENT_OBJECTS=${readEnv("RETENTION_DELETE_ATTACHMENT_OBJECTS") || "unset"}`
      : "Retention is in dry-run/safe mode.",
    detail:
      retentionDelete && !allowRetentionDelete
        ? "Re-run with --allow-retention-delete only after a cleanup window is approved."
        : "Retention delete gate is satisfied for this run mode.",
  });
}

async function addDnsChecks() {
  for (const name of [
    "API_DOMAIN",
    "ADMIN_DOMAIN",
    "CITIZEN_DOMAIN",
    "GATEWAY_DOMAIN",
    "MUNICIPALITY_DOMAIN",
  ]) {
    const domain = readEnv(name);
    if (!domain) continue;
    try {
      const addresses = await dns.resolve4(domain);
      const matches = expectedServerIp
        ? addresses.includes(expectedServerIp)
        : true;
      addCheck({
        id: `dns-${name.toLowerCase()}`,
        status: matches ? "passed" : "blocked",
        summary: expectedServerIp
          ? `${domain} resolves to ${addresses.join(", ")}. Expected ${expectedServerIp}.`
          : `${domain} resolves to ${addresses.join(", ")}.`,
        detail: expectedServerIp
          ? "EXPECTED_SERVER_IP / --expected-server-ip lets this script verify exact DNS target."
          : "No expected IP was provided; resolution-only check passed.",
      });
    } catch (error) {
      addCheck({
        id: `dns-${name.toLowerCase()}`,
        status: "blocked",
        summary: `${domain} does not resolve.`,
        detail: error.message,
      });
    }
  }
}

async function addHttpChecks() {
  const probes = [
    ["api-health", `${originFromDomain("API_DOMAIN")}/api/v1/health`, [200]],
    [
      "api-ready",
      `${originFromDomain("API_DOMAIN")}/api/v1/health/ready`,
      [200],
    ],
    ["gateway-health", `${originFromDomain("GATEWAY_DOMAIN")}/health`, [200]],
    ["admin-web", originFromDomain("ADMIN_DOMAIN"), [200, 301, 302, 307, 308]],
    [
      "citizen-web",
      originFromDomain("CITIZEN_DOMAIN"),
      [200, 301, 302, 307, 308],
    ],
    [
      "municipality-web",
      originFromDomain("MUNICIPALITY_DOMAIN"),
      [200, 301, 302, 307, 308],
    ],
  ];

  for (const [id, url, expectedStatuses] of probes) {
    if (!url.includes("://")) continue;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      addCheck({
        id,
        status: expectedStatuses.includes(response.status)
          ? "passed"
          : "blocked",
        summary: `${url} returned HTTP ${response.status}.`,
        detail: `Expected one of: ${expectedStatuses.join(", ")}`,
      });
    } catch (error) {
      addCheck({
        id,
        status: "warning",
        summary: `${url} could not be reached.`,
        detail: error.message,
      });
    }
  }

  if ((readEnv("ATTACHMENT_SCAN_PROVIDER") || "").toLowerCase() === "clamav") {
    const host = readEnv("CLAMAV_HOST");
    const port = Number(readEnv("CLAMAV_PORT") || 3310);
    if (host && !["clamav", "localhost", "127.0.0.1"].includes(host)) {
      const ok = await tcpPing(host, port, 5_000);
      addCheck({
        id: "clamav-tcp",
        status: ok ? "passed" : "warning",
        summary: ok
          ? `ClamAV TCP endpoint ${host}:${port} is reachable.`
          : `ClamAV TCP endpoint ${host}:${port} is not reachable from here.`,
        detail:
          "For in-compose clamav hostnames, run --compose on the VPS instead.",
      });
    }
  }
}

async function addComposeChecks() {
  const config = await run("docker", composeArgs(["config", "--quiet"]));
  commandResults.push({
    id: "compose-config",
    command: `docker ${composeArgs(["config", "--quiet"]).join(" ")}`,
    ...config,
  });
  addCheck({
    id: "compose-config",
    status: config.code === 0 ? "passed" : "blocked",
    summary:
      config.code === 0
        ? "Production compose config is valid."
        : "Production compose config failed validation.",
    detail: config.output.slice(-4_000),
  });

  const ps = await run("docker", composeArgs(["ps"]));
  commandResults.push({
    id: "compose-ps",
    command: `docker ${composeArgs(["ps"]).join(" ")}`,
    ...ps,
  });
  addCheck({
    id: "compose-ps",
    status: ps.code === 0 ? "passed" : "warning",
    summary:
      ps.code === 0
        ? "Production compose service state was read."
        : "Production compose service state could not be read.",
    detail: ps.output.slice(-4_000),
  });
}

async function runProductionDeploy() {
  if (!deployAccepted) {
    addCheck({
      id: "production-deploy",
      status: "blocked",
      summary: "Production deploy requested without explicit acceptance flag.",
      detail:
        "Re-run with --apply-deploy --i-accept-production-deploy after operator approval.",
    });
    return;
  }

  const steps = [
    ["deploy-build", "docker", composeArgs(["build"])],
    [
      "deploy-core-up",
      "docker",
      composeArgs([
        "up",
        "-d",
        "postgres",
        "redis",
        "minio",
        "minio-init",
        "clamav",
      ]),
    ],
    [
      "deploy-migrate",
      "docker",
      composeArgs(["run", "--rm", "api", "pnpm", "db:deploy"]),
    ],
    ["deploy-up", "docker", composeArgs(["up", "-d"])],
  ];

  for (const [id, command, commandArgs] of steps) {
    const result = await run(command, commandArgs);
    commandResults.push({
      id,
      command: `${command} ${commandArgs.join(" ")}`,
      ...result,
    });
    addCheck({
      id,
      status: result.code === 0 ? "passed" : "failed",
      summary: result.code === 0 ? `${id} completed.` : `${id} failed.`,
      detail: result.output.slice(-8_000),
    });
    if (result.code !== 0) break;
  }
}

function composeArgs(extra) {
  return [
    "compose",
    "--env-file",
    envFile,
    "-f",
    path.join(REPO_ROOT, "infra", "docker-compose.prod.yml"),
    ...extra,
  ];
}

async function run(command, commandArgs) {
  const started = Date.now();
  const invocation = buildInvocation(command, commandArgs);
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(invocation.command, invocation.args, {
        cwd: REPO_ROOT,
        env: { ...process.env, FORCE_COLOR: "0", CI: "1" },
      });
    } catch (error) {
      resolve({
        code: -1,
        durationMs: Date.now() - started,
        output: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({
        code: -1,
        durationMs: Date.now() - started,
        output: `${output}\n${error.message}`,
      });
    });
    child.on("close", (code) => {
      resolve({ code, durationMs: Date.now() - started, output });
    });
  });
}

function buildInvocation(command, commandArgs) {
  return { command, args: commandArgs };
}

function parseEnv(contents) {
  const env = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals === -1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function readOptions(rawArgs) {
  const result = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) continue;
    const value = rawArgs[index + 1];
    if (value && !value.startsWith("--")) {
      const key = arg
        .slice(2)
        .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      result[key] = value;
      index += 1;
    }
  }
  return result;
}

function addCheck(check) {
  checks.push({ ...check, detail: check.detail ?? "" });
}

function summarize(items) {
  const counts = { passed: 0, warning: 0, blocked: 0, failed: 0 };
  for (const item of items) counts[item.status] += 1;
  return {
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    reportPath,
    ...counts,
    status:
      counts.blocked || counts.failed
        ? "blocked"
        : counts.warning
          ? "warning"
          : "passed",
  };
}

function hasBlockingChecks() {
  return checks.some(
    (check) => check.status === "blocked" || check.status === "failed",
  );
}

function printHuman(summary) {
  console.log(`KentOS external systems: ${summary.status}`);
  console.log(
    `passed=${summary.passed} warning=${summary.warning} blocked=${summary.blocked} failed=${summary.failed}`,
  );
  console.log(`report=${summary.reportPath}`);
  for (const check of checks) {
    const marker =
      check.status === "passed"
        ? "PASS"
        : check.status === "warning"
          ? "WARN"
          : check.status === "failed"
            ? "FAIL"
            : "BLOCK";
    console.log(`[${marker}] ${check.id}: ${check.summary}`);
  }
}

function renderMarkdown(summary) {
  const lines = [
    "# KentOS External Systems Report",
    "",
    `Started: ${summary.startedAt}`,
    `Finished: ${summary.completedAt}`,
    `Status: ${summary.status}`,
    "",
    "| check | status | summary |",
    "|---|---|---|",
  ];
  for (const check of checks) {
    lines.push(
      `| ${check.id} | ${check.status} | ${escapeTable(check.summary)} |`,
    );
  }
  lines.push("", "## Details");
  for (const check of checks) {
    lines.push(
      "",
      `### ${check.id}`,
      "",
      `Status: ${check.status}`,
      "",
      check.detail || "No detail.",
    );
  }
  if (commandResults.length) {
    lines.push("", "## Command Results");
    for (const result of commandResults) {
      lines.push(
        "",
        `### ${result.id}`,
        "",
        `Command: ${result.command}`,
        `Exit: ${result.code}`,
        "",
        "```",
      );
      lines.push(result.output.slice(-12_000));
      lines.push("```");
    }
  }
  return `${lines.join("\n")}\n`;
}

function originFromDomain(name) {
  const domain = readEnv(name);
  return domain ? `https://${domain}` : "";
}

function readEnv(name) {
  return (process.env[name] ?? "").trim();
}

function relative(filePath) {
  return path.relative(REPO_ROOT, filePath) || ".";
}

function stamp(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function escapeTable(value) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function unique(values) {
  return [...new Set(values)];
}

function tcpPing(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}
