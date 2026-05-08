import { spawn } from 'node:child_process'

import { PrkitError } from './errors.js'

import type { CommandRunner } from './command-runner.js'

export function createNodeRunner(spawnCommand: typeof spawn = spawn): CommandRunner {
  return {
    run(input) {
      return new Promise((resolve, reject) => {
        const command = input.args[0]
        if (!command) {
          reject(new PrkitError('ENVIRONMENT_ERROR', 'cannot run an empty command'))
          return
        }

        const child = spawnCommand(command, input.args.slice(1), {
          cwd: input.cwd,
          stdio: 'pipe',
        })
        let stdout = ''
        let stderr = ''

        child.stdout?.on('data', (chunk) => {
          stdout += String(chunk)
        })
        child.stderr?.on('data', (chunk) => {
          stderr += String(chunk)
        })
        child.on('error', (error) => {
          reject(normalizeSpawnError(command, error))
        })
        child.on('close', (exitCode) => {
          resolve({
            stdout,
            stderr,
            exitCode: exitCode ?? 1,
          })
        })

        if (input.stdin !== undefined) {
          child.stdin?.write(input.stdin)
        }
        child.stdin?.end()
      })
    },
  }
}

function normalizeSpawnError(command: string, error: unknown): Error {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ENOENT'
  ) {
    return new PrkitError(
      'ENVIRONMENT_ERROR',
      getMissingCommandMessage(command),
      { command, code: 'ENOENT' },
    )
  }

  return error instanceof Error
    ? error
    : new Error(typeof error === 'string' ? error : String(error))
}

function getMissingCommandMessage(command: string): string {
  switch (command) {
    case 'linear':
      return 'prkit requires schpet/linear-cli (`linear`) on your PATH to load Linear issues. Install it from https://github.com/schpet/linear-cli.'
    case 'gh':
      return 'GitHub CLI (`gh`) is required. Install it from https://cli.github.com/ and ensure it is available on your PATH.'
    case 'git':
      return 'Git is required. Install it and ensure `git` is available on your PATH.'
    default:
      return `Required command not found: ${command}. Install it and ensure it is available on your PATH.`
  }
}
