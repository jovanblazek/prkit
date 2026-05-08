import { Command, CommanderError } from 'commander'
import { fileURLToPath } from 'node:url'

import { createPr } from '../pipeline/create-pr.js'
import { resolveDryRun, resolveMode, resolveOverrides } from './flags.js'
import {
  confirmPullRequest,
  previewPullRequest,
  resolveInteractiveOverrides,
} from './interactive.js'
import { renderError, renderInteractivePreview, renderResult } from './render.js'

export async function main(argv: string[]): Promise<number> {
  const program = new Command()
  const create = new Command('create')
  let exitCode = 1
  const mode = resolveMode(argv)

  program.name('prkit')
  program.exitOverride()
  create.exitOverride()
  const output = {
    writeErr: (message: string) => {
      if (mode !== 'non-interactive') {
        process.stderr.write(message)
      }
    },
  }
  program.configureOutput(output)
  create.configureOutput(output)

  create.option('--non-interactive')
  create.option('--dry-run')
  create.option('--ticket-id <ticketId>')
  create.option('--base-branch <baseBranch>')
  create.option('--title <title>')
  create.option('--body <body>')
  create.option('--body-file <bodyFile>')
  create.action(async (options) => {
    try {
      const parsedOverrides = resolveOverrides(options)
      const stdin = await readStdinIfAvailable(mode, parsedOverrides)
      const dryRun = resolveDryRun(options)
      const overrides =
        mode === 'interactive'
          ? await resolveInteractiveOverrides({
              stdin,
              overrides: parsedOverrides,
            })
          : parsedOverrides

      if (mode === 'interactive') {
        const preview = await previewPullRequest({
          cwd: process.cwd(),
          stdin,
          overrides,
        })

        process.stdout.write(renderInteractivePreview(preview))

        if (dryRun) {
          exitCode = 0
          return
        }

        if (!(await confirmPullRequest())) {
          exitCode = 1
          return
        }
      }

      const result = await createPr({
        mode,
        dryRun,
        cwd: process.cwd(),
        stdin,
        overrides,
      })

      process.stdout.write(renderResult(result, mode))
      exitCode = 0
    } catch (error) {
      const result = {
        ok: false as const,
        error: renderError(error),
      }

      process.stdout.write(renderResult(result, mode))
      exitCode = 1
    }
  })
  program.addCommand(create)

  try {
    await program.parseAsync(argv, { from: 'user' })
  } catch (error) {
    if (error instanceof CommanderError) {
      if (mode === 'non-interactive') {
        process.stdout.write(
          renderResult(
            {
              ok: false,
              error: {
                kind: 'INPUT_ERROR',
                message: error.message,
              },
            },
            mode,
          ),
        )
        return 1
      }

      return error.exitCode
    }

    throw error
  }

  return exitCode
}

function isDirectExecution(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url)
}

if (isDirectExecution()) {
  void main(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode
    })
    .catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
}
async function readStdinIfAvailable(
  mode: 'interactive' | 'non-interactive',
  explicitBodySource: {
    body?: string
    bodyFile?: string
  },
): Promise<string | undefined> {
  if (
    mode !== 'non-interactive' ||
    process.stdin.isTTY ||
    explicitBodySource.body !== undefined ||
    explicitBodySource.bodyFile !== undefined
  ) {
    return undefined
  }

  let stdin = ''
  for await (const chunk of process.stdin) {
    stdin += String(chunk)
  }

  return stdin
}
