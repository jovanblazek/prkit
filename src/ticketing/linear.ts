import { PrkitError } from '../core/errors.js'

import type { CommandRunner } from '../core/command-runner.js'
import type { TicketProvider } from './types.js'

interface LinearIssueViewResponse {
  identifier: string
  title: string
}

export class LinearTicketProvider implements TicketProvider {
  constructor(private readonly runner: CommandRunner) {}

  async getTicket(
    ticketId: string,
    cwd: string,
  ): Promise<{ id: string; title: string }> {
    const result = await this.runner.run({
      cwd,
      args: ['linear', 'issue', 'view', ticketId, '--json'],
    })

    if (result.exitCode !== 0) {
      throw new PrkitError(
        'PROVIDER_ERROR',
        'Failed to load Linear ticket. Make sure you are authenticated with Linear CLI.\nSet LINEAR_API_KEY, add api_key to .linear.toml, or run `linear auth login`.',
        {
          exitCode: result.exitCode,
          stderr: result.stderr.trim(),
        },
      )
    }

    const issue = parseLinearIssueViewResponse(result.stdout)

    return {
      id: issue.identifier,
      title: issue.title,
    }
  }
}

function parseLinearIssueViewResponse(stdout: string): LinearIssueViewResponse {
  let parsed: unknown

  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new PrkitError(
      'PROVIDER_ERROR',
      'Unable to parse Linear ticket response.',
    )
  }

  if (!isLinearIssueViewResponse(parsed)) {
    throw new PrkitError(
      'PROVIDER_ERROR',
      'Received invalid Linear ticket response.',
    )
  }

  return parsed
}

function isLinearIssueViewResponse(
  value: unknown,
): value is LinearIssueViewResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const issue = value as Record<string, unknown>
  return isNonBlankString(issue.identifier) && isNonBlankString(issue.title)
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
