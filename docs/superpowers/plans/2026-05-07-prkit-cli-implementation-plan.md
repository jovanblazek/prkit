# prkit CLI V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V1 `prkit` CLI that resolves ticket and repo context, supports interactive and non-interactive PR creation flows, and creates GitHub pull requests through `gh`.

**Architecture:** Keep the system split into a small orchestration pipeline plus edge adapters. Pure resolution logic lives in focused modules under `src/resolve`, provider and git/OS integration live behind interfaces, and the CLI layer owns prompts, editor behavior, and human/JSON rendering. Tests stay layered the same way: unit tests for pure logic, adapter tests for subprocess calls, and CLI/pipeline tests for end-to-end flow.

**Tech Stack:** Node.js, TypeScript, Vitest, `commander`, `prompts`, `yaml`, `zod`, `minimatch`

---

## File Structure

Planned files and responsibilities:

- `package.json`
  Add runtime dependencies, CLI bin entry, and targeted test scripts.
- `src/index.ts`
  Replace the starter export with the production entrypoint re-export surface.
- `src/cli/main.ts`
  Parse flags, choose mode, invoke the pipeline, and dispatch renderers.
- `src/cli/flags.ts`
  Define CLI flags and map them into normalized overrides.
- `src/cli/interactive.ts`
  Prompt flow, edit menu, confirmation step, and push approval handling.
- `src/cli/editor.ts`
  Open `$EDITOR` on a temp file and return edited body text.
- `src/cli/render.ts`
  Human-readable summaries and stable JSON success/error output.
- `src/core/types.ts`
  Shared request/result/config/provider types.
- `src/core/errors.ts`
  Stable error kinds plus serialization helpers for non-interactive mode.
- `src/core/command-runner.ts`
  Thin subprocess abstraction to make `git`, `gh`, and `linear` calls mockable.
- `src/config/schema.ts`
  Zod schema and parsed config types.
- `src/config/load.ts`
  Load global and repo config files, merge, validate, and resolve template paths.
- `src/git/repository.ts`
  Git repo checks, current branch, changed files, and remote validation.
- `src/git/push.ts`
  Branch pushed-state detection and push execution.
- `src/ticketing/types.ts`
  `TicketProvider` interface and normalized ticket type.
- `src/ticketing/linear.ts`
  Linear adapter backed by the `linear` CLI or a documented command contract.
- `src/pr/types.ts`
  `PrProvider` interface and normalized PR creation request/result types.
- `src/pr/github-gh.ts`
  GitHub adapter backed by `gh`.
- `src/resolve/ticket-id.ts`
  Branch regex ticket extraction.
- `src/resolve/title.ts`
  Default and customized PR title formatting.
- `src/resolve/body-source.ts`
  Enforce body source precedence and exclusivity.
- `src/resolve/reviewers.ts`
  Union/dedupe/filter reviewers from changed files and config rules.
- `src/pipeline/create-pr.ts`
  Mode-agnostic orchestration from discovered context to PR result.
- `tests/helpers/fakes.ts`
  Reusable command runner, temp config, and provider fakes.
- `tests/unit/*.test.ts`
  Pure resolver and config tests.
- `tests/adapters/*.test.ts`
  `git`, Linear, and GitHub adapter tests.
- `tests/e2e/*.test.ts`
  CLI-level interactive and non-interactive contract tests.

## Task 1: Replace the Starter With a Real CLI Skeleton

**Files:**
- Modify: `package.json`
- Modify: `src/index.ts`
- Create: `src/cli/main.ts`
- Create: `src/core/types.ts`
- Create: `src/core/errors.ts`
- Test: `tests/e2e/cli-smoke.test.ts`

- [ ] **Step 1: Write the failing CLI smoke test**

```ts
import { describe, expect, it } from 'vitest'

import { runCli } from '../helpers/fakes.js'

describe('cli smoke', () => {
  it('prints stable JSON for non-interactive usage errors', async () => {
    const result = await runCli(['create', '--non-interactive'], {
      cwd: '/repo',
      commandResults: [],
    })

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      error: {
        kind: 'ENVIRONMENT_ERROR',
      },
    })
  })
})
```

- [ ] **Step 2: Run the test to verify the starter does not satisfy it**

Run: `rtk pnpm test -- --run tests/e2e/cli-smoke.test.ts`
Expected: FAIL because the current `Hello, world!` entrypoint has no CLI contract.

- [ ] **Step 3: Add the CLI shell and package metadata**

```json
{
  "bin": {
    "prkit": "dist/cli/main.js"
  },
  "scripts": {
    "test:e2e": "vitest run tests/e2e",
    "test:unit": "vitest run tests/unit tests/adapters"
  },
  "dependencies": {
    "commander": "^14.0.1",
    "minimatch": "^10.1.1",
    "prompts": "^2.4.2",
    "yaml": "^2.8.1",
    "zod": "^4.1.12"
  }
}
```

```ts
// src/core/errors.ts
export type ErrorKind =
  | 'ENVIRONMENT_ERROR'
  | 'CONFIG_ERROR'
  | 'INPUT_ERROR'
  | 'PROVIDER_ERROR'

export class PrkitError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message)
  }
}
```

```ts
// src/cli/main.ts
import { Command } from 'commander'

export async function main(argv: string[]): Promise<number> {
  const program = new Command()
  program.name('prkit')
  program.command('create')
  return 1
}
```

- [ ] **Step 4: Re-run the smoke test**

Run: `rtk pnpm test -- --run tests/e2e/cli-smoke.test.ts`
Expected: FAIL moves from missing CLI to incomplete JSON contract, which confirms the right surface exists.

- [ ] **Step 5: Commit the skeleton**

```bash
rtk git add package.json src/index.ts src/cli/main.ts src/core/types.ts src/core/errors.ts tests/e2e/cli-smoke.test.ts
rtk git commit -m "feat: scaffold prkit cli entrypoint"
```

## Task 2: Build the Pure Resolution Layer First

**Files:**
- Create: `src/resolve/ticket-id.ts`
- Create: `src/resolve/title.ts`
- Create: `src/resolve/body-source.ts`
- Create: `src/resolve/reviewers.ts`
- Test: `tests/unit/ticket-id.test.ts`
- Test: `tests/unit/title.test.ts`
- Test: `tests/unit/body-source.test.ts`
- Test: `tests/unit/reviewers.test.ts`

- [ ] **Step 1: Write failing tests for branch inference, title formatting, body source rules, and reviewer filtering**

```ts
import { describe, expect, it } from 'vitest'

import { inferTicketId } from '../../src/resolve/ticket-id.js'

describe('inferTicketId', () => {
  it('extracts one ticket capture from branch name', () => {
    expect(
      inferTicketId('feature/ABC-123-add-prkit', /([A-Z]+-\d+)/),
    ).toBe('ABC-123')
  })

  it('returns null when the branch does not match', () => {
    expect(inferTicketId('main', /([A-Z]+-\d+)/)).toBeNull()
  })
})
```

```ts
import { resolveBodySource } from '../../src/resolve/body-source.js'

it('fails when stdin and --body are both supplied', () => {
  expect(() =>
    resolveBodySource({
      body: 'inline',
      stdin: 'stdin body',
    }),
  ).toThrow(/Exactly one explicit body source/)
})
```

```ts
import { resolveReviewers } from '../../src/resolve/reviewers.js'

it('dedupes reviewers and removes author plus assignee', () => {
  expect(
    resolveReviewers({
      changedFiles: ['src/cli/main.ts', 'src/pr/github-gh.ts'],
      defaultReviewers: ['alice', 'bob'],
      rules: [
        { pattern: 'src/cli/**', reviewers: ['carol', 'alice'] },
        { pattern: 'src/pr/**', reviewers: ['dave', 'bob'] },
      ],
      author: 'alice',
      assignee: 'dave',
    }),
  ).toEqual(['bob', 'carol'])
})
```

- [ ] **Step 2: Run the resolver test set**

Run: `rtk pnpm test -- --run tests/unit/ticket-id.test.ts tests/unit/title.test.ts tests/unit/body-source.test.ts tests/unit/reviewers.test.ts`
Expected: FAIL because the resolver modules do not exist yet.

- [ ] **Step 3: Implement the pure resolver modules**

```ts
// src/resolve/ticket-id.ts
export function inferTicketId(branchName: string, pattern: RegExp): string | null {
  const match = branchName.match(pattern)
  return match?.[1] ?? null
}
```

```ts
// src/resolve/title.ts
export function buildTitle(input: {
  ticketId: string
  ticketTitle: string
  titleFormat?: string
}): string {
  const template = input.titleFormat ?? '{ticketId}: {ticketTitle}'
  return template
    .replaceAll('{ticketId}', input.ticketId)
    .replaceAll('{ticketTitle}', input.ticketTitle)
}
```

```ts
// src/resolve/body-source.ts
import { readFileSync } from 'node:fs'

import { PrkitError } from '../core/errors.js'

export function resolveBodySource(input: {
  body?: string
  bodyFile?: string
  stdin?: string
  templatePath?: string
}): string {
  const explicit = [input.body, input.bodyFile, input.stdin].filter(
    (value) => value !== undefined,
  )

  if (explicit.length > 1) {
    throw new PrkitError('INPUT_ERROR', 'Exactly one explicit body source may be supplied')
  }

  if (input.body !== undefined) return input.body
  if (input.bodyFile !== undefined) return readFileSync(input.bodyFile, 'utf8')
  if (input.stdin !== undefined) return input.stdin
  if (input.templatePath !== undefined) return readFileSync(input.templatePath, 'utf8')
  return ''
}
```

- [ ] **Step 4: Run the resolver tests again**

Run: `rtk pnpm test -- --run tests/unit/ticket-id.test.ts tests/unit/title.test.ts tests/unit/body-source.test.ts tests/unit/reviewers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the pure logic layer**

```bash
rtk git add src/resolve tests/unit
rtk git commit -m "feat: add pure pr resolution logic"
```

## Task 3: Add Config Loading, Validation, and Template Resolution

**Files:**
- Create: `src/config/schema.ts`
- Create: `src/config/load.ts`
- Test: `tests/unit/config-load.test.ts`
- Test: `tests/helpers/fakes.ts`

- [ ] **Step 1: Write failing config tests for merge order, unknown keys, and template path resolution**

```ts
import { describe, expect, it } from 'vitest'

import { loadConfig } from '../../src/config/load.js'

it('merges global and repo config with repo values winning', async () => {
  const config = await loadConfig({
    cwd: '/repo',
    homeDir: '/home/test',
    readFile: async (path) => {
      if (path === '/home/test/.config/prkit/config.yml') {
        return 'baseBranch: main\ndefaultReviewers: [alice]\n'
      }
      if (path === '/repo/.prkit.yml') {
        return 'baseBranch: develop\n'
      }
      return null
    },
  })

  expect(config.baseBranch).toBe('develop')
  expect(config.defaultReviewers).toEqual(['alice'])
})
```

```ts
it('fails fast on unknown config fields', async () => {
  await expect(
    loadConfig({
      cwd: '/repo',
      homeDir: '/home/test',
      readFile: async () => 'baseBranch: main\nsurprise: true\n',
    }),
  ).rejects.toThrow(/Unknown/)
})
```

- [ ] **Step 2: Run the config test**

Run: `rtk pnpm test -- --run tests/unit/config-load.test.ts`
Expected: FAIL because config loading has not been implemented.

- [ ] **Step 3: Implement the config schema and loader**

```ts
// src/config/schema.ts
import { z } from 'zod'

export const reviewerRuleSchema = z.object({
  pattern: z.string().min(1),
  reviewers: z.array(z.string().min(1)).default([]),
})

export const configSchema = z
  .object({
    ticketProvider: z.literal('linear').default('linear'),
    ticketBranchPattern: z.string().min(1),
    baseBranch: z.string().min(1),
    titleFormat: z.string().min(1).optional(),
    descriptionTemplatePath: z.string().min(1).optional(),
    defaultReviewers: z.array(z.string().min(1)).default([]),
    reviewerRules: z.array(reviewerRuleSchema).default([]),
    draftByDefault: z.boolean().default(false),
    assignToCurrentUser: z.boolean().default(false),
  })
  .strict()
```

```ts
// src/config/load.ts
import path from 'node:path'
import os from 'node:os'

import YAML from 'yaml'

import { configSchema } from './schema.js'

const GLOBAL_NAMES = ['config.yml', 'config.yaml']
const REPO_NAMES = ['.prkit.yml', '.prkit.yaml']

async function readFirst(
  paths: string[],
  readFile: (path: string) => Promise<string | null>,
): Promise<{ path: string; content: string } | null> {
  for (const candidate of paths) {
    const content = await readFile(candidate)
    if (content !== null) return { path: candidate, content }
  }
  return null
}

export async function loadConfig(input: {
  cwd: string
  homeDir: string
  readFile?: (path: string) => Promise<string | null>
}) {
  const readFile = input.readFile ?? defaultReadFile
  const globalConfig = await readFirst(
    GLOBAL_NAMES.map((name) => path.join(input.homeDir, '.config/prkit', name)),
    readFile,
  )
  const repoConfig = await readFirst(
    REPO_NAMES.map((name) => path.join(input.cwd, name)),
    readFile,
  )

  const merged = {
    ...(globalConfig ? YAML.parse(globalConfig.content) : {}),
    ...(repoConfig ? YAML.parse(repoConfig.content) : {}),
  }

  const parsed = configSchema.parse(merged)
  if (parsed.descriptionTemplatePath) {
    const baseDir = repoConfig
      ? input.cwd
      : globalConfig
        ? path.dirname(globalConfig.path)
        : input.cwd

    parsed.descriptionTemplatePath = path.resolve(baseDir, parsed.descriptionTemplatePath)
  }

  return parsed
}
```

- [ ] **Step 4: Make the config tests pass**

Run: `rtk pnpm test -- --run tests/unit/config-load.test.ts`
Expected: PASS with coverage for merge behavior, unknown key rejection, and path resolution.

- [ ] **Step 5: Commit config support**

```bash
rtk git add src/config tests/unit/config-load.test.ts tests/helpers/fakes.ts
rtk git commit -m "feat: add config loading and validation"
```

## Task 4: Add Git Repository and Push-State Adapters

**Files:**
- Create: `src/core/command-runner.ts`
- Create: `src/git/repository.ts`
- Create: `src/git/push.ts`
- Test: `tests/adapters/git-repository.test.ts`
- Test: `tests/adapters/git-push.test.ts`

- [ ] **Step 1: Write failing adapter tests around git command construction**

```ts
import { describe, expect, it } from 'vitest'

import { getRepositoryContext } from '../../src/git/repository.js'
import { createFakeRunner } from '../helpers/fakes.js'

it('requires origin to point to GitHub', async () => {
  const runner = createFakeRunner([
    { args: ['git', 'rev-parse', '--show-toplevel'], stdout: '/repo\n' },
    { args: ['git', 'remote', 'get-url', 'origin'], stdout: 'git@gitlab.com:org/repo.git\n' },
  ])

  await expect(getRepositoryContext({ cwd: '/repo', runner })).rejects.toThrow(/GitHub/)
})
```

```ts
import { isBranchPushed } from '../../src/git/push.js'

it('returns false when upstream ref lookup fails', async () => {
  const runner = createFakeRunner([
    { args: ['git', 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], error: true },
  ])

  await expect(isBranchPushed({ runner })).resolves.toBe(false)
})
```

- [ ] **Step 2: Run the git adapter tests**

Run: `rtk pnpm test -- --run tests/adapters/git-repository.test.ts tests/adapters/git-push.test.ts`
Expected: FAIL because the adapter layer is not present.

- [ ] **Step 3: Implement the subprocess abstraction and git adapters**

```ts
// src/core/command-runner.ts
export interface CommandRunner {
  run(input: {
    cwd: string
    args: string[]
    stdin?: string
  }): Promise<{ stdout: string; stderr: string; exitCode: number }>
}
```

```ts
// src/git/repository.ts
export async function getRepositoryContext(input: {
  cwd: string
  runner: CommandRunner
}) {
  const root = await input.runner.run({
    cwd: input.cwd,
    args: ['git', 'rev-parse', '--show-toplevel'],
  })
  const branch = await input.runner.run({
    cwd: input.cwd,
    args: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
  })
  const remote = await input.runner.run({
    cwd: input.cwd,
    args: ['git', 'remote', 'get-url', 'origin'],
  })

  if (!/github\.com[:/]/.test(remote.stdout)) {
    throw new PrkitError('ENVIRONMENT_ERROR', 'origin remote must point to GitHub')
  }

  return {
    rootDir: root.stdout.trim(),
    branchName: branch.stdout.trim(),
    originUrl: remote.stdout.trim(),
  }
}
```

```ts
// src/git/push.ts
export async function pushCurrentBranch(input: {
  cwd: string
  branchName: string
  runner: CommandRunner
}): Promise<void> {
  await input.runner.run({
    cwd: input.cwd,
    args: ['git', 'push', '--set-upstream', 'origin', input.branchName],
  })
}
```

- [ ] **Step 4: Re-run the adapter tests**

Run: `rtk pnpm test -- --run tests/adapters/git-repository.test.ts tests/adapters/git-push.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit git integration**

```bash
rtk git add src/core/command-runner.ts src/git tests/adapters
rtk git commit -m "feat: add git repository and push adapters"
```

## Task 5: Implement Linear and GitHub Provider Adapters

**Files:**
- Create: `src/ticketing/types.ts`
- Create: `src/ticketing/linear.ts`
- Create: `src/pr/types.ts`
- Create: `src/pr/github-gh.ts`
- Test: `tests/adapters/linear.test.ts`
- Test: `tests/adapters/github-gh.test.ts`

- [ ] **Step 1: Write failing provider tests for command contracts and JSON parsing**

```ts
import { describe, expect, it } from 'vitest'

import { LinearTicketProvider } from '../../src/ticketing/linear.js'
import { createFakeRunner } from '../helpers/fakes.js'

it('maps a Linear lookup into the normalized ticket shape', async () => {
  const runner = createFakeRunner([
    {
      args: ['linear', 'issue', 'view', 'ENG-42', '--json'],
      stdout: '{"identifier":"ENG-42","title":"Ship CLI"}\n',
    },
  ])

  const provider = new LinearTicketProvider(runner)
  await expect(provider.getTicket('ENG-42', '/repo')).resolves.toEqual({
    id: 'ENG-42',
    title: 'Ship CLI',
  })
})
```

```ts
import { GitHubGhPrProvider } from '../../src/pr/github-gh.js'

it('creates a PR through gh with reviewer, assignee, and draft flags', async () => {
  const runner = createFakeRunner([
    {
      args: [
        'gh',
        'pr',
        'create',
        '--base',
        'main',
        '--title',
        'ENG-42: Ship CLI',
        '--body',
        'Body',
        '--assignee',
        '@me',
        '--reviewer',
        'alice,bob',
        '--draft',
        '--json',
        'number,url,id',
      ],
      stdout: '{"number":17,"url":"https://github.com/org/repo/pull/17","id":"PR_kw"}\n',
    },
  ])

  const provider = new GitHubGhPrProvider(runner)
  const result = await provider.createPullRequest('/repo', {
    baseBranch: 'main',
    title: 'ENG-42: Ship CLI',
    body: 'Body',
    assignee: '@me',
    reviewers: ['alice', 'bob'],
    draft: true,
  })

  expect(result.url).toContain('/pull/17')
})
```

- [ ] **Step 2: Run the provider adapter tests**

Run: `rtk pnpm test -- --run tests/adapters/linear.test.ts tests/adapters/github-gh.test.ts`
Expected: FAIL because provider implementations do not exist yet.

- [ ] **Step 3: Implement the provider interfaces and adapters**

```ts
// src/ticketing/types.ts
export interface TicketProvider {
  getTicket(ticketId: string, cwd: string): Promise<{ id: string; title: string }>
}
```

```ts
// src/pr/types.ts
export interface PrProvider {
  getAuthenticatedUser(cwd: string): Promise<string>
  createPullRequest(
    cwd: string,
    input: {
      baseBranch: string
      title: string
      body: string
      reviewers: string[]
      assignee?: string
      draft: boolean
    },
  ): Promise<{ id: string; number: number; url: string }>
}
```

```ts
// src/pr/github-gh.ts
const args = ['gh', 'pr', 'create', '--base', input.baseBranch, '--title', input.title, '--body', input.body]
if (input.assignee) args.push('--assignee', input.assignee)
if (input.reviewers.length > 0) args.push('--reviewer', input.reviewers.join(','))
if (input.draft) args.push('--draft')
args.push('--json', 'number,url,id')
```

- [ ] **Step 4: Re-run the provider tests**

Run: `rtk pnpm test -- --run tests/adapters/linear.test.ts tests/adapters/github-gh.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit provider support**

```bash
rtk git add src/ticketing src/pr tests/adapters
rtk git commit -m "feat: add linear and github provider adapters"
```

## Task 6: Implement the Shared Create-PR Pipeline and JSON Contract

**Files:**
- Create: `src/pipeline/create-pr.ts`
- Modify: `src/core/types.ts`
- Modify: `src/cli/render.ts`
- Test: `tests/unit/create-pr-pipeline.test.ts`
- Test: `tests/e2e/non-interactive.test.ts`

- [ ] **Step 1: Write failing tests for the pipeline and non-interactive JSON output**

```ts
import { describe, expect, it } from 'vitest'

import { createPr } from '../../src/pipeline/create-pr.js'

it('returns a dry-run result without remote mutation', async () => {
  const result = await createPr({
    mode: 'non-interactive',
    dryRun: true,
    cwd: '/repo',
    overrides: { ticketId: 'ENG-42' },
    deps: makePipelineDeps(),
  })

  expect(result).toMatchObject({
    dryRun: true,
    created: false,
    ticketId: 'ENG-42',
  })
})
```

```ts
it('emits structured JSON errors in non-interactive mode', async () => {
  const result = await runCli(['create', '--non-interactive'], {
    cwd: '/repo',
    commandResults: [{ args: ['git', 'rev-parse', '--show-toplevel'], error: true }],
  })

  expect(JSON.parse(result.stdout)).toMatchObject({
    ok: false,
    error: {
      kind: 'ENVIRONMENT_ERROR',
      message: expect.any(String),
    },
  })
})
```

- [ ] **Step 2: Run the pipeline tests**

Run: `rtk pnpm test -- --run tests/unit/create-pr-pipeline.test.ts tests/e2e/non-interactive.test.ts`
Expected: FAIL because the orchestration layer is missing.

- [ ] **Step 3: Implement the mode-agnostic pipeline**

```ts
// src/pipeline/create-pr.ts
export async function createPr(input: CreatePrInput): Promise<CreatePrResult> {
  const repo = await input.deps.git.getRepositoryContext(input.cwd)
  const config = await input.deps.config.load(input.cwd)
  const ticketId =
    input.overrides.ticketId ??
    inferTicketId(repo.branchName, new RegExp(config.ticketBranchPattern))

  if (!ticketId) {
    throw new PrkitError('INPUT_ERROR', 'Could not infer ticket ID from the current branch')
  }

  const ticket = await input.deps.ticketProvider.getTicket(ticketId, input.cwd)
  const baseBranch = input.overrides.baseBranch ?? config.baseBranch
  const reviewers = resolveReviewers({
    changedFiles: await input.deps.git.getChangedFiles(input.cwd, baseBranch),
    defaultReviewers: config.defaultReviewers,
    rules: config.reviewerRules,
    author: repo.author,
    assignee: undefined,
  })

  const ticket = await input.deps.ticketProvider.getTicket(ticketId, input.cwd)
  const title =
    input.overrides.title ??
    buildTitle({
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      titleFormat: config.titleFormat,
    })
  const body = resolveBodySource({
    body: input.overrides.body,
    bodyFile: input.overrides.bodyFile,
    stdin: input.stdin,
    templatePath: config.descriptionTemplatePath,
  })

  if (input.dryRun) {
    return {
      ok: true,
      dryRun: true,
      created: false,
      ticketId: ticket.id,
      title,
      baseBranch,
      reviewers,
      assignee: null,
    }
  }

  if (!(await input.deps.git.isBranchPushed(input.cwd))) {
    throw new PrkitError('INPUT_ERROR', 'Current branch must be pushed before PR creation')
  }

  const created = await input.deps.prProvider.createPullRequest(input.cwd, {
    baseBranch,
    title,
    body,
    reviewers,
    draft: input.overrides.draft ?? config.draftByDefault,
  })

  return {
    ok: true,
    dryRun: false,
    created: true,
    ticketId: ticket.id,
    title,
    baseBranch,
    reviewers,
    assignee: null,
    pr: created,
  }
}
```

- [ ] **Step 4: Make the pipeline and JSON tests pass**

Run: `rtk pnpm test -- --run tests/unit/create-pr-pipeline.test.ts tests/e2e/non-interactive.test.ts`
Expected: PASS with success and structured failure coverage.

- [ ] **Step 5: Commit the shared pipeline**

```bash
rtk git add src/pipeline src/core/types.ts src/cli/render.ts tests/unit/create-pr-pipeline.test.ts tests/e2e/non-interactive.test.ts
rtk git commit -m "feat: add shared create pr pipeline"
```

## Task 7: Add Interactive Flow, Editor Integration, and Final CLI Wiring

**Files:**
- Create: `src/cli/flags.ts`
- Create: `src/cli/interactive.ts`
- Create: `src/cli/editor.ts`
- Create: `src/cli/render.ts`
- Modify: `src/cli/main.ts`
- Test: `tests/e2e/interactive.test.ts`
- Test: `tests/e2e/dry-run.test.ts`

- [ ] **Step 1: Write failing interactive and dry-run CLI tests**

```ts
import { describe, expect, it } from 'vitest'

import { runCli } from '../helpers/fakes.js'

it('shows resolved fields before confirmation in interactive mode', async () => {
  const result = await runCli([], {
    cwd: '/repo',
    promptReplies: ['confirm'],
    commandResults: makeHappyPathCommands(),
  })

  expect(result.stdout).toContain('Ticket: ENG-42')
  expect(result.stdout).toContain('Base branch: main')
  expect(result.stdout).toContain('Reviewers: alice, bob')
})
```

```ts
it('prints JSON only for non-interactive dry run', async () => {
  const result = await runCli(['--non-interactive', '--dry-run'], {
    cwd: '/repo',
    commandResults: makeHappyPathCommands(),
  })

  expect(result.stderr).toBe('')
  expect(JSON.parse(result.stdout)).toMatchObject({
    ok: true,
    dryRun: true,
    created: false,
  })
})
```

- [ ] **Step 2: Run the end-to-end CLI tests**

Run: `rtk pnpm test -- --run tests/e2e/interactive.test.ts tests/e2e/dry-run.test.ts`
Expected: FAIL because the CLI is not wired to the pipeline or prompt/editor helpers.

- [ ] **Step 3: Implement prompts, editor handling, summaries, and main command wiring**

```ts
// src/cli/flags.ts
export interface CliOverrides {
  ticketId?: string
  baseBranch?: string
  title?: string
  body?: string
  bodyFile?: string
  reviewers?: string[]
  assignee?: string
  draft?: boolean
}
```

```ts
// src/cli/editor.ts
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

export async function editBody(initialBody: string, editorCommand: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'prkit-'))
  const file = path.join(dir, 'pull-request.md')
  await writeFile(file, initialBody, 'utf8')
  await new Promise<void>((resolve, reject) => {
    const child = spawn(editorCommand, [file], { stdio: 'inherit' })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Editor exited ${code}`))))
    child.on('error', reject)
  })
  return await readFile(file, 'utf8')
}
```

```ts
// src/cli/main.ts
const mode = options.nonInteractive ? 'non-interactive' : 'interactive'
const result = await createPr({
  mode,
  dryRun: options.dryRun,
  cwd: process.cwd(),
  overrides,
  deps,
})
return renderResult(result, mode)
```

- [ ] **Step 4: Run the full suite**

Run: `rtk pnpm test`
Expected: PASS.

Run: `rtk pnpm typecheck`
Expected: PASS.

Run: `rtk pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit the end-to-end CLI**

```bash
rtk git add src tests package.json pnpm-lock.yaml
rtk git commit -m "feat: complete prkit cli v1 flow"
```

## Task 8: Tighten Edge Cases and Document Runtime Assumptions

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Test: `tests/e2e/error-contract.test.ts`
- Test: `tests/unit/body-source.test.ts`
- Test: `tests/adapters/github-gh.test.ts`

- [ ] **Step 1: Write failing tests for the remaining important edge cases**

```ts
it('fails when multiple body sources are provided', async () => {
  const result = await runCli(['--non-interactive', '--body', 'x', '--body-file', 'body.md'], {
    cwd: '/repo',
  })

  expect(result.exitCode).toBe(1)
  expect(JSON.parse(result.stdout)).toMatchObject({
    ok: false,
    error: { kind: 'INPUT_ERROR' },
  })
})
```

```ts
it('fails non-interactive mode when the branch is not pushed', async () => {
  const result = await runCli(['--non-interactive'], {
    cwd: '/repo',
    commandResults: makeUnpushedBranchCommands(),
  })

  expect(JSON.parse(result.stdout)).toMatchObject({
    ok: false,
    error: { kind: 'INPUT_ERROR' },
  })
})
```

- [ ] **Step 2: Run the edge-case test set**

Run: `rtk pnpm test -- --run tests/e2e/error-contract.test.ts tests/unit/body-source.test.ts tests/adapters/github-gh.test.ts`
Expected: FAIL on the missing edge cases.

- [ ] **Step 3: Fill the contract gaps and document the tool**

```md
# prkit

## Requirements

- `gh` installed and authenticated
- execution from inside a git repository with an `origin` GitHub remote
- Linear CLI available for ticket lookup

## Examples

```sh
prkit
prkit create --dry-run
prkit create --non-interactive --ticket-id ENG-42 --base-branch main
```
```

- [ ] **Step 4: Re-run focused verification and then the full suite**

Run: `rtk pnpm test -- --run tests/e2e/error-contract.test.ts tests/unit/body-source.test.ts tests/adapters/github-gh.test.ts`
Expected: PASS.

Run: `rtk pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit the contract cleanup**

```bash
rtk git add README.md tests
rtk git commit -m "docs: document runtime assumptions and edge cases"
```

## Self-Review

Spec coverage check:

- Command model, mode split, dry-run behavior, and shared pipeline are covered in Tasks 1, 6, and 7.
- Config file discovery, merge order, schema validation, and template path behavior are covered in Task 3.
- Ticket inference, base branch resolution, title formatting, body source rules, and reviewer resolution are covered in Tasks 2 and 6.
- GitHub assumptions, pushed-branch handling, and `gh` PR creation are covered in Tasks 4, 5, and 8.
- Interactive edit/confirm flow and non-interactive JSON-only output are covered in Task 7.
- Stable error payloads and edge-case regressions are covered in Tasks 6 and 8.

Gap check:

- The spec assumes a concrete Linear lookup mechanism but does not define the exact command syntax. Task 5 therefore treats the Linear command contract as an implementation decision that must be pinned in code and tests before integration.
- The current repo has no `README.md`. Task 8 should create it if absent rather than treating it as an existing file.

Placeholder scan:

- No `TODO`, `TBD`, or “similar to above” placeholders remain.

Type consistency check:

- Shared names are consistent across tasks: `TicketProvider`, `PrProvider`, `PrkitError`, `createPr`, `inferTicketId`, `resolveBodySource`, and `resolveReviewers`.
- The CLI mode strings stay consistent as `interactive` and `non-interactive`.
