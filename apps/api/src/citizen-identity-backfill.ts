import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@kentos/database';
import { CitizenIdentityService, type TenantCitizenBackfillReport, type TenantCitizenBackfillMode } from './modules/public/citizen-identity.service.js';
import type { PrismaService } from './modules/prisma/prisma.service.js';

type CliOptions = {
  tenantId: string | null;
  allTenants: boolean;
  mode: TenantCitizenBackfillMode;
  outputPath: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  let tenantId: string | null = null;
  let allTenants = false;
  let mode: TenantCitizenBackfillMode = 'dry-run';
  let outputPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--tenant') {
      tenantId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--all-tenants') {
      allTenants = true;
      continue;
    }

    if (arg === '--apply') {
      mode = 'apply';
      continue;
    }

    if (arg === '--dry-run') {
      mode = 'dry-run';
      continue;
    }

    if (arg === '--output') {
      outputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
  }

  if ((!tenantId && !allTenants) || (tenantId && allTenants)) {
    throw new Error('Use either --tenant <tenantId> or --all-tenants.');
  }

  return {
    tenantId,
    allTenants,
    mode,
    outputPath,
  };
}

async function writeOutput(outputPath: string, payload: string) {
  const normalizedPath = path.resolve(outputPath);
  await mkdir(path.dirname(normalizedPath), { recursive: true });
  await writeFile(normalizedPath, payload, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();

    const service = new CitizenIdentityService(prisma as unknown as PrismaService);
    const tenantIds = options.tenantId
      ? [options.tenantId]
      : (await prisma.tenant.findMany({
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        })).map((tenant) => tenant.id);

    const reports: TenantCitizenBackfillReport[] = [];
    for (const tenantId of tenantIds) {
      reports.push(
        await service.backfillTenantCitizens({
          tenantId,
          mode: options.mode,
        }),
      );
    }

    const output = {
      generatedAt: new Date().toISOString(),
      mode: options.mode,
      tenantCount: reports.length,
      readyForPhase3: reports.every((report) => report.readiness.readyForPhase3),
      unresolvedExceptionCount: reports.reduce((sum, report) => sum + report.totals.manualReviewCount, 0),
      mergeCandidateCount: reports.reduce((sum, report) => sum + report.totals.mergeCount, 0),
      reports,
    };

    const serialized = `${JSON.stringify(output, null, 2)}\n`;

    if (options.outputPath) {
      await writeOutput(options.outputPath, serialized);
    }

    process.stdout.write(serialized);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown citizen identity backfill failure';
  console.error(message);
  process.exitCode = 1;
});
