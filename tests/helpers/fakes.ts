import { PassThrough } from 'node:stream'

import { expect, vi } from 'vitest'

import type { CommandRunner } from '../../src/core/command-runner.js'

export interface RunCliOptions {
  cwd: string
  commandResults: unknown[]
  createPrResult?: unknown
  createPrResults?: unknown[]
  createPrError?: unknown
  stdin?: string
  promptReplies?: Array<Record<string, unknown>>
  editorResult?: string
}

export async function runCli(
  argv: string[],
  options: RunCliOptions,
): Promise<{
  exitCode: number
  stdout: string
  stderr: string
  createPrCalls: unknown[]
  promptCalls: unknown[]
}> {
  if (!Array.isArray(options.commandResults)) {
    throw new TypeError('runCli expected commandResults to be an array')
  }

  let stdout = ''
  let stderr = ''
  const createPrCalls: unknown[] = []
  const promptCalls: unknown[] = []
  const write = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stdout += String(chunk)
      return true
    })
  const writeErr = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stderr += String(chunk)
      return true
    })
  const log = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout += `${args.join(' ')}\n`
  })
  const cwd = vi.spyOn(process, 'cwd').mockReturnValue(options.cwd)
  const stdin = new PassThrough()
  Object.defineProperty(stdin, 'isTTY', {
    value: options.stdin === undefined,
  })
  if (options.stdin !== undefined) {
    stdin.end(options.stdin)
  }
  const stdinSpy = vi.spyOn(process, 'stdin', 'get').mockReturnValue(
    stdin as typeof process.stdin,
  )

  try {
    vi.resetModules()
    vi.doMock('prompts', () => ({
      default: vi.fn(async (questions: unknown) => {
        promptCalls.push(questions)
        return options.promptReplies?.shift() ?? {}
      }),
    }))
    vi.doMock('../../src/cli/editor.js', () => ({
      editBody: vi.fn(async () => options.editorResult ?? ''),
    }))
    if (
      options.createPrError !== undefined ||
      options.createPrResult !== undefined ||
      options.createPrResults !== undefined
    ) {
      const queuedResults = [...(options.createPrResults ?? [])]
      vi.doMock('../../src/pipeline/create-pr.js', () => ({
        createPr: vi.fn(async (input) => {
          createPrCalls.push(input)
          if (options.createPrError !== undefined) {
            throw options.createPrError
          }

          if (queuedResults.length > 0) {
            return queuedResults.shift()
          }

          return options.createPrResult
        }),
      }))
    }
    const entrypoint = await import('../../src/index.js')

    if (typeof entrypoint.main === 'function') {
      const exitCode = await entrypoint.main(argv)
      return { exitCode, stdout, stderr, createPrCalls, promptCalls }
    }

    return { exitCode: 0, stdout, stderr, createPrCalls, promptCalls }
  } finally {
    vi.doUnmock('prompts')
    vi.doUnmock('../../src/cli/editor.js')
    vi.doUnmock('../../src/pipeline/create-pr.js')
    stdinSpy.mockRestore()
    cwd.mockRestore()
    log.mockRestore()
    writeErr.mockRestore()
    write.mockRestore()
  }
}

export interface FakeCommandResult {
  stdout?: string
  stderr?: string
  exitCode?: number
}

export interface FakeCommandExpectation extends FakeCommandResult {
  cwd?: string
  args: string[]
}

export function createFakeRunner(
  expectations: FakeCommandExpectation[],
): CommandRunner & {
  calls: Array<{ cwd: string; args: string[]; stdin?: string }>
  assertComplete(): void
} {
  const pending = [...expectations]
  const calls: Array<{ cwd: string; args: string[]; stdin?: string }> = []

  return {
    calls,
    async run(input) {
      calls.push(input)

      const next = pending.shift()
      if (!next) {
        throw new Error(`Unexpected command: ${input.args.join(' ')}`)
      }

      expect(input.args).toEqual(next.args)

      if (next.cwd !== undefined) {
        expect(input.cwd).toBe(next.cwd)
      }

      return {
        stdout: next.stdout ?? '',
        stderr: next.stderr ?? '',
        exitCode: next.exitCode ?? 0,
      }
    },
    assertComplete() {
      expect(pending).toHaveLength(0)
    },
  }
}
