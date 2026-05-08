import { describe, expect, it } from 'vitest'

import { PrkitError } from '../../src/core/errors.js'
import { getRepositoryContext } from '../../src/git/repository.js'
import { createFakeRunner } from '../helpers/fakes.js'

describe('getRepositoryContext', () => {
  it('reads repository root branch name and GitHub origin remote', async () => {
    const runner = createFakeRunner([
      { cwd: '/repo/subdir', args: ['git', 'rev-parse', '--show-toplevel'], stdout: '/repo\n' },
      { cwd: '/repo/subdir', args: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], stdout: 'feat/task-4\n' },
      {
        cwd: '/repo/subdir',
        args: ['git', 'remote', 'get-url', 'origin'],
        stdout: 'git@github.com:org/repo.git\n',
      },
    ])

    await expect(getRepositoryContext({ cwd: '/repo/subdir', runner })).resolves.toEqual({
      rootDir: '/repo',
      branchName: 'feat/task-4',
      originUrl: 'git@github.com:org/repo.git',
    })

    runner.assertComplete()
  })

  it('requires origin to point to GitHub', async () => {
    const runner = createFakeRunner([
      { cwd: '/repo', args: ['git', 'rev-parse', '--show-toplevel'], stdout: '/repo\n' },
      { cwd: '/repo', args: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], stdout: 'main\n' },
      {
        cwd: '/repo',
        args: ['git', 'remote', 'get-url', 'origin'],
        stdout: 'git@gitlab.com:org/repo.git\n',
      },
    ])

    await expect(getRepositoryContext({ cwd: '/repo', runner })).rejects.toEqual(
      new PrkitError('ENVIRONMENT_ERROR', 'origin remote must point to GitHub'),
    )

    runner.assertComplete()
  })

  it('rejects remotes whose host only looks like github.com', async () => {
    const runner = createFakeRunner([
      { cwd: '/repo', args: ['git', 'rev-parse', '--show-toplevel'], stdout: '/repo\n' },
      { cwd: '/repo', args: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], stdout: 'main\n' },
      {
        cwd: '/repo',
        args: ['git', 'remote', 'get-url', 'origin'],
        stdout: 'git@notgithub.com:org/repo.git\n',
      },
    ])

    await expect(getRepositoryContext({ cwd: '/repo', runner })).rejects.toEqual(
      new PrkitError('ENVIRONMENT_ERROR', 'origin remote must point to GitHub'),
    )

    runner.assertComplete()
  })

  it('rejects detached HEAD', async () => {
    const runner = createFakeRunner([
      { cwd: '/repo', args: ['git', 'rev-parse', '--show-toplevel'], stdout: '/repo\n' },
      { cwd: '/repo', args: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], stdout: 'HEAD\n' },
    ])

    await expect(getRepositoryContext({ cwd: '/repo', runner })).rejects.toEqual(
      new PrkitError('ENVIRONMENT_ERROR', 'detached HEAD is not supported'),
    )

    runner.assertComplete()
  })

  it('fails when repository root lookup exits nonzero', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['git', 'rev-parse', '--show-toplevel'],
        stderr: 'fatal: not a git repository (or any of the parent directories): .git\n',
        exitCode: 128,
      },
    ])

    await expect(getRepositoryContext({ cwd: '/repo', runner })).rejects.toEqual(
      new PrkitError(
        'ENVIRONMENT_ERROR',
        'failed to resolve repository root',
        expect.objectContaining({
          exitCode: 128,
          stderr: 'fatal: not a git repository (or any of the parent directories): .git',
        }),
      ),
    )

    runner.assertComplete()
  })

  it('fails when origin remote lookup exits nonzero', async () => {
    const runner = createFakeRunner([
      { cwd: '/repo', args: ['git', 'rev-parse', '--show-toplevel'], stdout: '/repo\n' },
      { cwd: '/repo', args: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], stdout: 'main\n' },
      {
        cwd: '/repo',
        args: ['git', 'remote', 'get-url', 'origin'],
        stderr: "error: No such remote 'origin'\n",
        exitCode: 2,
      },
    ])

    await expect(getRepositoryContext({ cwd: '/repo', runner })).rejects.toEqual(
      new PrkitError(
        'ENVIRONMENT_ERROR',
        'failed to resolve origin remote',
        expect.objectContaining({
          exitCode: 2,
          stderr: "error: No such remote 'origin'",
        }),
      ),
    )

    runner.assertComplete()
  })
})
