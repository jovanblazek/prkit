import { PrkitError } from '../core/errors.js'

import type { CliErrorShape, CliResult } from '../core/types.js'

export function renderResult(result: CliResult, mode: 'interactive' | 'non-interactive'): string {
  if (mode === 'non-interactive') {
    return `${JSON.stringify(result)}\n`
  }

  if (!result.ok) {
    return `${result.error.message}\n`
  }

  const status = result.dryRun ? 'Dry run ready' : 'Pull request created'
  return `${status}: ${result.title}\n`
}

export function renderError(error: unknown): CliErrorShape {
  if (error instanceof PrkitError || isPrkitErrorLike(error)) {
    return {
      kind: error.kind,
      message: error.message,
      detail: error.detail,
    }
  }

  return {
    kind: 'ENVIRONMENT_ERROR',
    message: error instanceof Error ? error.message : String(error),
  }
}

function isPrkitErrorLike(
  error: unknown,
): error is Pick<PrkitError, 'kind' | 'message' | 'detail'> {
  if (!(error instanceof Error) || !('kind' in error)) {
    return false
  }

  return typeof error.kind === 'string'
}
