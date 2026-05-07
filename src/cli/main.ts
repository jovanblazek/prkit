import { Command, CommanderError } from 'commander'
import { fileURLToPath } from 'node:url'

export async function main(argv: string[]): Promise<number> {
  const program = new Command()
  const create = new Command('create')

  program.name('prkit')
  program.exitOverride()

  create.option('--non-interactive')
  program.addCommand(create)

  try {
    await program.parseAsync(argv, { from: 'user' })
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode
    }

    throw error
  }

  return 1
}

function isDirectExecution(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url)
}

if (isDirectExecution()) {
  void main(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode
  })
}
