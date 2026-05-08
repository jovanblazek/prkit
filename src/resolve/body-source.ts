import { readFileSync } from 'node:fs'

import { PrkitError } from '../core/errors.js'

export interface ResolveBodySourceInput {
  body?: string
  bodyFile?: string
  stdin?: string
  templatePath?: string
}

export function resolveBodySource(input: ResolveBodySourceInput): string {
  const explicitSourceCount = [input.body, input.bodyFile, input.stdin].filter(
    (value) => value !== undefined,
  ).length

  if (explicitSourceCount > 1) {
    throw new PrkitError(
      'INPUT_ERROR',
      'Exactly one explicit body source may be supplied',
    )
  }

  if (input.body !== undefined) {
    return input.body
  }

  if (input.bodyFile !== undefined) {
    return readFileSync(input.bodyFile, 'utf8')
  }

  if (input.stdin !== undefined) {
    return input.stdin
  }

  if (input.templatePath !== undefined) {
    return readFileSync(input.templatePath, 'utf8')
  }

  return ''
}
