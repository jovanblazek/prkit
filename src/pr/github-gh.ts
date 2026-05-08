import { PrkitError } from '../core/errors.js'

import type { CommandRunner } from '../core/command-runner.js'
import type { CreatePullRequestInput, PrProvider } from './types.js'

interface GhCreatePullRequestResponse {
  id: string
  number: number
  url: string
}

export class GitHubGhPrProvider implements PrProvider {
  constructor(private readonly runner: CommandRunner) {}

  async getAuthenticatedUser(cwd: string): Promise<string> {
    const result = await this.runner.run({
      cwd,
      args: ['gh', 'api', 'user', '--jq', '.login'],
    })

    if (result.exitCode !== 0) {
      throw new PrkitError(
        'PROVIDER_ERROR',
        'Failed to resolve authenticated GitHub user. Make sure you are authenticated with GitHub CLI.\nRun `gh auth login`.',
        {
          exitCode: result.exitCode,
          stderr: result.stderr.trim(),
        },
      )
    }

    const user = result.stdout.trim()
    if (!isAuthenticatedUser(user)) {
      throw new PrkitError(
        'PROVIDER_ERROR',
        'received invalid authenticated GitHub user',
      )
    }

    return user
  }

  async createPullRequest(
    cwd: string,
    input: CreatePullRequestInput,
  ): Promise<{ id: string; number: number; url: string }> {
    const args = [
      'gh',
      'pr',
      'create',
      '--base',
      input.baseBranch,
      '--title',
      input.title,
      '--body',
      input.body,
    ]

    if (input.assignee) {
      args.push('--assignee', input.assignee)
    }

    if (input.reviewers.length > 0) {
      args.push('--reviewer', input.reviewers.join(','))
    }

    if (input.draft) {
      args.push('--draft')
    }

    args.push('--json', 'number,url,id')

    const result = await this.runner.run({
      cwd,
      args,
    })

    if (result.exitCode !== 0) {
      throw new PrkitError(
        'PROVIDER_ERROR',
        'Failed to create GitHub pull request.',
        {
          exitCode: result.exitCode,
          stderr: result.stderr.trim(),
        },
      )
    }

    const pullRequest = parseCreatePullRequestResponse(result.stdout)

    return {
      id: pullRequest.id,
      number: pullRequest.number,
      url: pullRequest.url,
    }
  }
}

function parseCreatePullRequestResponse(
  stdout: string,
): GhCreatePullRequestResponse {
  let parsed: unknown

  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new PrkitError(
      'PROVIDER_ERROR',
      'Received invalid GitHub pull request response.',
    )
  }

  if (!isGhCreatePullRequestResponse(parsed)) {
    throw new PrkitError(
      'PROVIDER_ERROR',
      'Received invalid GitHub pull request response.',
    )
  }

  return parsed
}

function isGhCreatePullRequestResponse(
  value: unknown,
): value is GhCreatePullRequestResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const pullRequest = value as Record<string, unknown>
  return (
    isNonBlankString(pullRequest.id) &&
    typeof pullRequest.number === 'number' &&
    isNonBlankString(pullRequest.url)
  )
}

function isAuthenticatedUser(value: string): boolean {
  return value.length > 0 && value !== 'null'
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
