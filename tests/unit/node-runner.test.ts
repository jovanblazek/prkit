import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { PrkitError } from '../../src/core/errors.js'
import { createNodeRunner } from '../../src/core/node-runner.js'

function createSpawnError(code: string, syscall: string): NodeJS.ErrnoException {
  const error = new Error(`${syscall} ${code}`) as NodeJS.ErrnoException
  error.code = code
  error.syscall = syscall
  return error
}

function createFakeChildProcess() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough
    stderr: PassThrough
    stdin: PassThrough
  }
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.stdin = new PassThrough()
  return child
}

describe('createNodeRunner', () => {
  it('normalizes missing linear into an actionable environment error', async () => {
    const runner = createNodeRunner(() => {
      const child = createFakeChildProcess()
      queueMicrotask(() => {
        child.emit('error', createSpawnError('ENOENT', 'spawn linear'))
      })
      return child
    })

    await expect(
      runner.run({
        cwd: '/repo',
        args: ['linear', 'issue', 'view', 'ENG-1', '--json'],
      }),
    ).rejects.toEqual(
      new PrkitError(
        'ENVIRONMENT_ERROR',
        'prkit requires schpet/linear-cli (`linear`) on your PATH to load Linear issues. Install it from https://github.com/schpet/linear-cli.',
        {
          command: 'linear',
          code: 'ENOENT',
        },
      ),
    )
  })

  it('normalizes missing gh into an actionable environment error', async () => {
    const runner = createNodeRunner(() => {
      const child = createFakeChildProcess()
      queueMicrotask(() => {
        child.emit('error', createSpawnError('ENOENT', 'spawn gh'))
      })
      return child
    })

    await expect(
      runner.run({
        cwd: '/repo',
        args: ['gh', 'api', 'user', '--jq', '.login'],
      }),
    ).rejects.toEqual(
      new PrkitError(
        'ENVIRONMENT_ERROR',
        'GitHub CLI (`gh`) is required. Install it from https://cli.github.com/ and ensure it is available on your PATH.',
        {
          command: 'gh',
          code: 'ENOENT',
        },
      ),
    )
  })

  it('returns successful stdout and stderr when the command closes normally', async () => {
    const runner = createNodeRunner(() => {
      const child = createFakeChildProcess()
      queueMicrotask(() => {
        child.stdout.write('ok\n')
        child.stderr.write('warn\n')
        child.stdout.end()
        child.stderr.end()
        child.emit('close', 0)
      })
      return child
    })

    await expect(
      runner.run({
        cwd: '/repo',
        args: ['git', 'status'],
      }),
    ).resolves.toEqual({
      stdout: 'ok\n',
      stderr: 'warn\n',
      exitCode: 0,
    })
  })
})
