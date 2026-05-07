import { Command } from 'commander'

export async function main(argv: string[]): Promise<number> {
  const program = new Command()
  const create = new Command('create')

  program.name('prkit')
  program.exitOverride()

  create.option('--non-interactive')
  program.addCommand(create)

  try {
    await program.parseAsync(argv, { from: 'user' })
  } catch {
    return 1
  }

  return 1
}
