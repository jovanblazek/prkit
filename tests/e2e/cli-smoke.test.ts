import { describe, expect, it, vi } from 'vitest'

async function runCli(argv: string[]): Promise<{
  exitCode: number
  stdout: string
}> {
  let stdout = ''
  const write = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stdout += String(chunk)
      return true
    })
  const log = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout += `${args.join(' ')}\n`
  })

  try {
    vi.resetModules()
    const entrypoint = await import('../../src/index.js')

    if (typeof entrypoint.main === 'function') {
      const exitCode = await entrypoint.main(argv)
      return { exitCode, stdout }
    }

    return { exitCode: 0, stdout }
  } finally {
    log.mockRestore()
    write.mockRestore()
  }
}

describe('cli smoke', () => {
  it('prints stable JSON for non-interactive usage errors', async () => {
    const result = await runCli(['create', '--non-interactive'])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      error: {
        kind: 'ENVIRONMENT_ERROR',
      },
    })
  })
})
