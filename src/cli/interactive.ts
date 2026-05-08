import prompts from 'prompts'

import { createPr } from '../pipeline/create-pr.js'
import { editBody } from './editor.js'

import type { CreatePrOverrides } from '../pipeline/create-pr.js'
import type { CreatePrSuccessResult } from '../core/types.js'

export async function resolveInteractiveOverrides(input: {
  stdin?: string
  overrides: CreatePrOverrides
}): Promise<CreatePrOverrides> {
  if (
    input.stdin !== undefined ||
    input.overrides.body !== undefined ||
    input.overrides.bodyFile !== undefined ||
    !process.env.EDITOR
  ) {
    return input.overrides
  }

  const body = await editBody('', process.env.EDITOR)

  return body.trim().length === 0
    ? input.overrides
    : {
        ...input.overrides,
        body,
      }
}

export async function previewPullRequest(input: {
  cwd: string
  stdin?: string
  overrides: CreatePrOverrides
}): Promise<CreatePrSuccessResult> {
  return createPr({
    mode: 'interactive',
    dryRun: true,
    cwd: input.cwd,
    stdin: input.stdin,
    overrides: input.overrides,
  })
}

export async function confirmPullRequest(): Promise<boolean> {
  const response = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: 'Create pull request?',
    initial: true,
  })

  return response.confirmed === true
}
