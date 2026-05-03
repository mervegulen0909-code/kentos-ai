# Parallel Agent Mode

This workflow lets the project run in a disciplined orchestrator plus worker model when a task is large enough to benefit from parallel execution.

Use it when:

- the work spans API, admin web, citizen web, worker, or docs at the same time,
- one task can be split into multiple non-overlapping file scopes,
- verification can run in parallel with implementation,
- the user explicitly asks for agent mode, parallel mode, or multi-agent execution.

Do not use it when:

- the task is a small single-file fix,
- multiple workers would edit the same files,
- the next step is blocked on one narrow local change that is faster to do directly.

## Orchestrator role

The orchestrator stays in the main thread and is responsible for:

1. understanding the user goal,
2. reading the current repo state,
3. splitting the task into safe file-scoped work packages,
4. assigning parallel workers only where write scopes do not overlap,
5. integrating outputs,
6. running verification,
7. reporting one merged result.

The orchestrator should keep the critical path local when a result is needed immediately.

## Worker task format

All worker tasks should use this exact structure:

```text
Worker task:
- Role:
- Goal:
- Scope:
- Files allowed:
- Files forbidden:
- Inputs to read:
- Exact steps:
- Constraints:
- Output expected:
- Verification command:
- Stop conditions:
- Escalation trigger:
```

## Default role presets

Use these as defaults unless the task needs a narrower split:

- API / backend:
  NestJS, Prisma, auth, RBAC, audit, public ticket, queue contracts
- Admin web:
  Next.js App Router staff UX, forms, notices, role-aware controls
- Citizen web:
  Next.js public report/track flows, public-safe copy, tracking UX
- Worker / notifications:
  BullMQ processors, delivery traces, reporting, async workflows
- QA / smoke:
  typecheck, build, API smoke, browser/manual verification, regression checks
- Docs / handoff:
  workflow docs, run logs, handoff notes, verification notes

## Recommended command presets

### Quick preset

Use for medium tasks:

```text
parallel mode ac, repo'yu analiz et, isi cakismayan parcalara bol, uygun agentlari paralel calistir, beni kisa statuslerle guncel tut, sonunda birlesik sonuc ver
```

### Balanced preset

Use for most feature work:

```text
PARALLEL AGENT MODE

Bu iste orchestrator gibi calis.
Once repo'yu ve degisen alanlari analiz et.
Sonra isi bagimsiz, cakismayan parcalara bol.

Kurallar:
- Once kisa ana plan cikar.
- Uygun gorursen birden fazla agent ac.
- Her agent icin dar, net ve dosya-scope'lu gorev tanimla.
- Ayni dosya alanini iki agente ayni anda verme.
- Sen merkez orchestrator olarak kal.
- Agent ciktlarini birlestir.
- Gerekirse ikinci tur agent ac.
- Her onemli asamada kisa durum guncellemesi ver.
- Is bitmeden durma.

Finalde sunlari ozetle:
- yapilanlar
- hangi agent ne yapti
- test/build/smoke sonuclari
- kalan riskler
- siradaki en mantikli adim
```

### Maximum quality preset

Use for large cross-cutting work:

```text
MULTI-AGENT EXECUTION MODE

Bu isi orchestrator gibi yonet.
Problemi analiz et, sonra bagimsiz is paketlerine bol.
Uygun yerlerde paralel agentlar ac ve her birine su formatla gorev ver:

Worker task:
- Role:
- Goal:
- Scope:
- Files allowed:
- Files forbidden:
- Inputs to read:
- Exact steps:
- Constraints:
- Output expected:
- Verification command:
- Stop conditions:
- Escalation trigger:

Kurallar:
- Kritik path bloklayan isi mumkunse sen yap.
- Yan isleri agentlara dagit.
- Agentlar arasinda write-scope cakismasi olmasin.
- Her agent sonucu gelince entegre et.
- Gerekirse ikinci dalga agent ac.
- Build, typecheck ve smoke mumkunse kos.
- Sonunda birlesik final rapor uret.
```

## Safe splitting rules

- Split by ownership boundary first, not by arbitrary file count.
- Prefer one worker per surface:
  `apps/api`, `apps/admin-web`, `apps/citizen-web`, `apps/worker`, `docs`.
- Keep schema or shared contract changes local unless they can be coordinated very tightly.
- If `packages/shared` changes are required, avoid parallel edits in dependents until the contract is stable.
- When touching Prisma schema or migrations, keep database work tightly controlled and verify with `pnpm db:generate`.

## Verification order

Use the smallest relevant checks during each worker slice, then run broader checks after integration:

```bash
pnpm db:generate
pnpm typecheck
pnpm build
```

If API or public ticket flows changed:

```bash
KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api
```

If UI changed, also use:

- `docs/workflows/browser-smoke.md`
- `docs/workflows/local-smoke.md`

## Good default split for this repo

For a typical feature wave, start with:

1. API / backend worker
2. Admin web worker
3. Citizen web worker
4. QA / smoke worker

Only add more workers when the write scopes are still clean.

## Expected final report shape

The orchestrator final report should include:

- what changed,
- which workers were used,
- what was verified,
- what remains risky or deferred,
- the next best move.
