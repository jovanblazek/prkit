import { describe, expect, it } from 'vitest'

import { PrkitError } from '../../src/core/errors.js'
import { runCli } from '../helpers/fakes.js'

async function expectInputError(
  args: string[],
  message: string,
  commandResults: unknown[],
) {
  const result = await runCli(args, {
    cwd: '/repo',
    commandResults,
    createPrError: new PrkitError('INPUT_ERROR', message),
  })

  expect(result.exitCode).toBe(1)
  expect(result.stderr).toBe('')
  expect(JSON.parse(result.stdout)).toEqual({
    ok: false,
    error: {
      kind: 'INPUT_ERROR',
      message,
    },
  })
}

describe('error contract', () => {
  it('emits structured JSON when multiple explicit body sources are supplied', async () => {
    await expectInputError(
      ['create', '--non-interactive', '--body', 'x', '--body-file', 'body.md'],
      'Exactly one explicit body source may be supplied',
      [],
    )
  })

  it('emits structured JSON when non-interactive creation fails because the branch is not pushed', async () => {
    await expectInputError(
      ['create', '--non-interactive'],
      'Current branch must be pushed before PR creation',
      [{}],
    )
  })
})
