import type { ErrorKind } from './errors.js'

export interface CliInvocation {
  argv: string[]
  cwd?: string
}

export interface PullRequestRef {
  id: string
  number: number
  url: string
}

export interface CliErrorShape {
  kind: ErrorKind
  message: string
  detail?: Record<string, unknown>
}

export interface DryRunSuccessResult {
  ok: true
  dryRun: true
  created: false
  ticketId: string
  baseBranch: string
  title: string
  reviewers: string[]
}

export interface CreatedSuccessResult {
  ok: true
  dryRun: false
  created: true
  ticketId: string
  baseBranch: string
  title: string
  reviewers: string[]
  pr: PullRequestRef
}

export interface CliFailureResult {
  ok: false
  error: CliErrorShape
}

export type CreatePrSuccessResult = DryRunSuccessResult | CreatedSuccessResult

export type CliResult = CreatePrSuccessResult | CliFailureResult
