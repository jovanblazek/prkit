import { describe, expect, it } from 'vitest'

import { PrkitError } from '../../src/core/errors.js'
import { isBranchPushed, pushCurrentBranch } from '../../src/git/push.js'
import { createFakeRunner } from '../helpers/fakes.js'

describe('isBranchPushed', () => {
  it('returns false when upstream ref lookup fails', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['git', 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
        stderr: 'fatal: no upstream configured\n',
        exitCode: 128,
      },
    ])

    await expect(isBranchPushed({ cwd: '/repo', runner })).resolves.toBe(false)

    runner.assertComplete()
  })

  it('returns true when upstream ref lookup succeeds', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['git', 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
        stdout: 'origin/feat/task-4\n',
      },
    ])

    await expect(isBranchPushed({ cwd: '/repo', runner })).resolves.toBe(true)

    runner.assertComplete()
  })

  it('fails when upstream lookup fails for a reason other than missing upstream', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['git', 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
        stderr: 'fatal: not a git repository (or any of the parent directories): .git\n',
        exitCode: 128,
      },
    ])

    await expect(isBranchPushed({ cwd: '/repo', runner })).rejects.toEqual(
      new PrkitError(
        'ENVIRONMENT_ERROR',
        'failed to resolve branch upstream',
        expect.objectContaining({
          exitCode: 128,
          stderr: 'fatal: not a git repository (or any of the parent directories): .git',
        }),
      ),
    )

    runner.assertComplete()
  })
})

describe('pushCurrentBranch', () => {
  it('pushes the current branch to origin and sets upstream', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['git', 'push', '--set-upstream', 'origin', 'feat/task-4'],
      },
    ])

    await expect(
      pushCurrentBranch({ cwd: '/repo', branchName: 'feat/task-4', runner }),
    ).resolves.toBeUndefined()

    runner.assertComplete()
  })

  it('fails when git push exits nonzero', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['git', 'push', '--set-upstream', 'origin', 'feat/task-4'],
        stderr: 'fatal: remote error\n',
        exitCode: 1,
      },
    ])

    await expect(
      pushCurrentBranch({ cwd: '/repo', branchName: 'feat/task-4', runner }),
    ).rejects.toEqual(
      new PrkitError(
        'ENVIRONMENT_ERROR',
        'failed to push current branch',
        expect.objectContaining({
          exitCode: 1,
          stderr: 'fatal: remote error',
        }),
      ),
    )

    runner.assertComplete()
  })
})
