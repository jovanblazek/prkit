import type { ErrorKind } from './errors.js'

export interface CliInvocation {
  argv: string[]
  cwd?: string
}

export interface CliErrorShape {
  kind: ErrorKind
  message: string
  detail?: Record<string, unknown>
}

export interface CliResult {
  ok: boolean
  error?: CliErrorShape
}
