import { PrkitError } from '../core/errors.js'

import type { CommandRunner } from '../core/command-runner.js'

export interface RepositoryContext {
  rootDir: string
  branchName: string
  originUrl: string
}

export async function getRepositoryContext(input: {
  cwd: string
  runner: CommandRunner
}): Promise<RepositoryContext> {
  const root = await input.runner.run({
    cwd: input.cwd,
    args: ['git', 'rev-parse', '--show-toplevel'],
  })
  assertGitSuccess(root, 'failed to resolve repository root')

  const branch = await input.runner.run({
    cwd: input.cwd,
    args: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
  })
  assertGitSuccess(branch, 'failed to resolve current branch')
  const branchName = branch.stdout.trim()
  if (branchName === 'HEAD') {
    throw new PrkitError('ENVIRONMENT_ERROR', 'detached HEAD is not supported')
  }

  const remote = await input.runner.run({
    cwd: input.cwd,
    args: ['git', 'remote', 'get-url', 'origin'],
  })
  assertGitSuccess(remote, 'failed to resolve origin remote')

  const originUrl = remote.stdout.trim()
  if (!isGitHubRemote(originUrl)) {
    throw new PrkitError('ENVIRONMENT_ERROR', 'origin remote must point to GitHub')
  }

  return {
    rootDir: root.stdout.trim(),
    branchName,
    originUrl,
  }
}

function assertGitSuccess(
  result: {
    stdout: string
    stderr: string
    exitCode: number
  },
  message: string,
): void {
  if (result.exitCode === 0) {
    return
  }

  throw new PrkitError('ENVIRONMENT_ERROR', message, {
    exitCode: result.exitCode,
    stderr: result.stderr.trim(),
  })
}

function isGitHubRemote(originUrl: string): boolean {
  return /^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https?:\/\/github\.com\/)/i.test(
    originUrl,
  )
}
