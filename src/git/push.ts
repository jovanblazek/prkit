import { PrkitError } from '../core/errors.js'

import type { CommandRunner } from '../core/command-runner.js'

export async function isBranchPushed(input: {
  cwd: string
  runner: CommandRunner
}): Promise<boolean> {
  const result = await input.runner.run({
    cwd: input.cwd,
    args: ['git', 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
  })

  if (result.exitCode === 0) {
    return true
  }

  const stderr = result.stderr.trim()
  if (/no upstream (configured|branch)/i.test(stderr)) {
    return false
  }

  throw new PrkitError('ENVIRONMENT_ERROR', 'failed to resolve branch upstream', {
    exitCode: result.exitCode,
    stderr,
  })
}

export async function pushCurrentBranch(input: {
  cwd: string
  branchName: string
  runner: CommandRunner
}): Promise<void> {
  const result = await input.runner.run({
    cwd: input.cwd,
    args: ['git', 'push', '--set-upstream', 'origin', input.branchName],
  })

  if (result.exitCode !== 0) {
    throw new PrkitError('ENVIRONMENT_ERROR', 'failed to push current branch', {
      exitCode: result.exitCode,
      stderr: result.stderr.trim(),
    })
  }
}
