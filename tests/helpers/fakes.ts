import { vi } from 'vitest'

export interface RunCliOptions {
  cwd: string
  commandResults: unknown[]
}

export async function runCli(
  argv: string[],
  options: RunCliOptions,
): Promise<{
  exitCode: number
  stdout: string
}> {
  if (!Array.isArray(options.commandResults)) {
    throw new TypeError('runCli expected commandResults to be an array')
  }

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
  const cwd = vi.spyOn(process, 'cwd').mockReturnValue(options.cwd)

  try {
    vi.resetModules()
    const entrypoint = await import('../../src/index.js')

    if (typeof entrypoint.main === 'function') {
      const exitCode = await entrypoint.main(argv)
      return { exitCode, stdout }
    }

    return { exitCode: 0, stdout }
  } finally {
    cwd.mockRestore()
    log.mockRestore()
    write.mockRestore()
  }
}
