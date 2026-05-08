import { spawn } from 'node:child_process'
import os from 'node:os'

import { loadConfig } from '../config/load.js'
import { PrkitError } from '../core/errors.js'
import { getRepositoryContext } from '../git/repository.js'
import { isBranchPushed } from '../git/push.js'
import { GitHubGhPrProvider } from '../pr/github-gh.js'
import { resolveBodySource } from '../resolve/body-source.js'
import { resolveReviewers } from '../resolve/reviewers.js'
import { inferTicketId } from '../resolve/ticket-id.js'
import { buildTitle } from '../resolve/title.js'
import { LinearTicketProvider } from '../ticketing/linear.js'

import type { CommandRunner } from '../core/command-runner.js'
import type { CreatePrSuccessResult } from '../core/types.js'
import type { PrkitConfig } from '../config/schema.js'
import type { RepositoryContext } from '../git/repository.js'
import type { PrProvider } from '../pr/types.js'
import type { TicketProvider } from '../ticketing/types.js'

export interface CreatePrOverrides {
  ticketId?: string
  baseBranch?: string
  title?: string
  body?: string
  bodyFile?: string
}

export interface CreatePrInput {
  mode: 'interactive' | 'non-interactive'
  dryRun: boolean
  cwd: string
  stdin?: string
  overrides: CreatePrOverrides
  deps?: CreatePrDeps
}

export interface CreatePrDeps {
  git: {
    getRepositoryContext(cwd: string): Promise<RepositoryContext>
    getChangedFiles(cwd: string, baseBranch: string): Promise<string[]>
    isBranchPushed(cwd: string): Promise<boolean>
  }
  config: {
    load(cwd: string): Promise<PrkitConfig>
  }
  ticketProvider: TicketProvider
  prProvider: PrProvider
}

export async function createPr(
  input: CreatePrInput,
): Promise<CreatePrSuccessResult> {
  const deps = input.deps ?? createDefaultDeps()
  const repo = await deps.git.getRepositoryContext(input.cwd)
  const repoCwd = repo.rootDir
  const config = await deps.config.load(repoCwd)
  const ticketId =
    input.overrides.ticketId ??
    inferTicketId(repo.branchName, new RegExp(config.ticketBranchPattern))

  if (!ticketId) {
    throw new PrkitError(
      'INPUT_ERROR',
      'Could not infer ticket ID from the current branch',
    )
  }

  const ticket = await deps.ticketProvider.getTicket(ticketId, repoCwd)
  const baseBranch = input.overrides.baseBranch ?? config.baseBranch
  const changedFiles = await deps.git.getChangedFiles(repoCwd, baseBranch)
  const reviewers = resolveReviewers({
    changedFiles,
    defaultReviewers: config.defaultReviewers,
    rules: config.reviewerRules,
  })
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
      baseBranch,
      title,
      reviewers,
    }
  }

  if (!(await deps.git.isBranchPushed(repoCwd))) {
    throw new PrkitError(
      'INPUT_ERROR',
      'Current branch must be pushed before PR creation',
    )
  }

  const pr = await deps.prProvider.createPullRequest(repoCwd, {
    baseBranch,
    title,
    body,
    reviewers,
  })

  return {
    ok: true,
    dryRun: false,
    created: true,
    ticketId: ticket.id,
    baseBranch,
    title,
    reviewers,
    pr,
  }
}

function createDefaultDeps(): CreatePrDeps {
  const runner = createNodeRunner()

  return {
    git: {
      getRepositoryContext(cwd) {
        return getRepositoryContext({ cwd, runner })
      },
      async getChangedFiles(cwd, baseBranch) {
        const result = await runner.run({
          cwd,
          args: ['git', 'diff', '--name-only', `${baseBranch}...HEAD`],
        })

        if (result.exitCode !== 0) {
          throw new PrkitError('ENVIRONMENT_ERROR', 'failed to resolve changed files', {
            exitCode: result.exitCode,
            stderr: result.stderr.trim(),
          })
        }

        return result.stdout
          .split('\n')
          .map((file) => file.trim())
          .filter((file) => file.length > 0)
      },
      isBranchPushed(cwd) {
        return isBranchPushed({ cwd, runner })
      },
    },
    config: {
      load(cwd) {
        return loadConfig({ cwd, homeDir: os.homedir() })
      },
    },
    ticketProvider: new LinearTicketProvider(runner),
    prProvider: new GitHubGhPrProvider(runner),
  }
}

function createNodeRunner(): CommandRunner {
  return {
    run(input) {
      return new Promise((resolve, reject) => {
        const child = spawn(input.args[0]!, input.args.slice(1), {
          cwd: input.cwd,
          stdio: 'pipe',
        })
        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (chunk) => {
          stdout += String(chunk)
        })
        child.stderr.on('data', (chunk) => {
          stderr += String(chunk)
        })
        child.on('error', reject)
        child.on('close', (exitCode) => {
          resolve({
            stdout,
            stderr,
            exitCode: exitCode ?? 1,
          })
        })

        if (input.stdin !== undefined) {
          child.stdin.write(input.stdin)
        }
        child.stdin.end()
      })
    },
  }
}
