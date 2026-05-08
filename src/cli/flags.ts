import type { CreatePrOverrides } from '../pipeline/create-pr.js'

export interface CliFlagOptions {
  nonInteractive?: boolean
  dryRun?: boolean
  ticketId?: string
  baseBranch?: string
  title?: string
  body?: string
  bodyFile?: string
}

export function resolveMode(argv: string[]): 'interactive' | 'non-interactive' {
  return argv.includes('--non-interactive') ? 'non-interactive' : 'interactive'
}

export function resolveDryRun(options: CliFlagOptions): boolean {
  return Boolean(options.dryRun)
}

export function resolveOverrides(options: CliFlagOptions): CreatePrOverrides {
  return {
    ticketId: options.ticketId,
    baseBranch: options.baseBranch,
    title: options.title,
    body: options.body,
    bodyFile: options.bodyFile,
  }
}
