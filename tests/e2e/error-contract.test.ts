import { describe, expect, it } from 'vitest'

import { PrkitError } from '../../src/core/errors.js'
import { runCli } from '../helpers/fakes.js'

describe('error contract', () => {
  it('emits structured JSON when multiple explicit body sources are supplied', async () => {
    const result = await runCli(
      ['create', '--non-interactive', '--body', 'x', '--body-file', 'body.md'],
      {
        cwd: '/repo',
        commandResults: [],
        createPrError: new PrkitError(
          'INPUT_ERROR',
          'Exactly one explicit body source may be supplied',
        ),
      },
    )

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toEqual({
      ok: false,
      error: {
        kind: 'INPUT_ERROR',
        message: 'Exactly one explicit body source may be supplied',
      },
    })
  })

  it('emits structured JSON when non-interactive creation fails because the branch is not pushed', async () => {
    const result = await runCli(['create', '--non-interactive'], {
      cwd: '/repo',
      commandResults: [{}],
      createPrError: new PrkitError(
        'INPUT_ERROR',
        'Current branch must be pushed before PR creation',
      ),
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toEqual({
      ok: false,
      error: {
        kind: 'INPUT_ERROR',
        message: 'Current branch must be pushed before PR creation',
      },
    })
  })
})
