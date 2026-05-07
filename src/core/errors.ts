export type ErrorKind =
  | 'ENVIRONMENT_ERROR'
  | 'CONFIG_ERROR'
  | 'INPUT_ERROR'
  | 'PROVIDER_ERROR'

export class PrkitError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'PrkitError'
  }
}
