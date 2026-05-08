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

  async createPullRequest(
    cwd: string,
    input: CreatePullRequestInput,
  ): Promise<{ id: string; number: number; url: string }> {
    const createArgs = [
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

    if (input.assignToCurrentUser) {
      createArgs.push('--assignee', '@me')
    }

    if (input.reviewers.length > 0) {
      createArgs.push('--reviewer', input.reviewers.join(','))
    }

    if (input.draft) {
      createArgs.push('--draft')
    }

    const createResult = await this.runner.run({
      cwd,
      args: createArgs,
    })

    if (createResult.exitCode !== 0) {
      throw new PrkitError(
        'PROVIDER_ERROR',
        'Failed to create GitHub pull request.',
        {
          exitCode: createResult.exitCode,
          stderr: createResult.stderr.trim(),
        },
      )
    }

    const pullRequestUrl = parseCreatePullRequestUrl(createResult.stdout)
    const viewResult = await this.runner.run({
      cwd,
      args: ['gh', 'pr', 'view', pullRequestUrl, '--json', 'number,url,id'],
    })

    if (viewResult.exitCode !== 0) {
      throw new PrkitError(
        'PROVIDER_ERROR',
        'Failed to create GitHub pull request.',
        {
          exitCode: viewResult.exitCode,
          stderr: viewResult.stderr.trim(),
        },
      )
    }

    const pullRequest = parseCreatePullRequestResponse(viewResult.stdout)

    return {
      id: pullRequest.id,
      number: pullRequest.number,
      url: pullRequest.url,
    }
  }
}

function parseCreatePullRequestUrl(stdout: string): string {
  const value = stdout.trim()

  if (!isNonBlankString(value)) {
    throw new PrkitError(
      'PROVIDER_ERROR',
      'Received invalid GitHub pull request response.',
    )
  }

  return value
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

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
