import { describe, expect, it } from 'vitest'

import { PrkitError } from '../../src/core/errors.js'
import { runCli } from '../helpers/fakes.js'

const dryRunResult = {
  ok: true as const,
  dryRun: true,
  created: false,
  ticketId: 'ENG-42',
  baseBranch: 'main',
  title: 'ENG-42: Build shared pipeline',
  reviewers: [],
}

function expectSingleCreatePrCall(
  result: { exitCode: number; createPrCalls: unknown[] },
  expected: Record<string, unknown>,
) {
  expect(result.exitCode).toBe(0)
  expect(result.createPrCalls).toHaveLength(1)
  expect(result.createPrCalls[0]).toMatchObject(expected)
}

describe('non-interactive cli', () => {
  it('passes stdin through to the shared create-pr pipeline', async () => {
    const result = await runCli(['create', '--non-interactive', '--dry-run'], {
      cwd: '/repo',
      commandResults: [],
      stdin: 'body from stdin',
      createPrResult: dryRunResult,
    })

    expectSingleCreatePrCall(result, {
      mode: 'non-interactive',
      dryRun: true,
      cwd: '/repo',
      stdin: 'body from stdin',
    })
  })

  it('does not forward stdin when an explicit body source is supplied', async () => {
    const result = await runCli(
      ['create', '--non-interactive', '--dry-run', '--body', 'inline body'],
      {
        cwd: '/repo',
        commandResults: [],
        stdin: 'body from stdin',
        createPrResult: dryRunResult,
      },
    )

    expectSingleCreatePrCall(result, {
      mode: 'non-interactive',
      dryRun: true,
      cwd: '/repo',
      stdin: undefined,
      overrides: {
        body: 'inline body',
      },
    })
  })

  it('emits structured JSON errors in non-interactive mode', async () => {
    const result = await runCli(['create', '--non-interactive'], {
      cwd: '/repo',
      commandResults: [],
      createPrError: new PrkitError(
        'ENVIRONMENT_ERROR',
        'failed to resolve repository root',
        { exitCode: 128 },
      ),
    })

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({
      ok: false,
      error: {
        kind: 'ENVIRONMENT_ERROR',
        message: 'failed to resolve repository root',
        detail: {
          exitCode: 128,
        },
      },
    })
  })

  it('emits structured JSON for commander parsing failures in non-interactive mode', async () => {
    const result = await runCli(
      ['create', '--non-interactive', '--definitely-not-a-real-flag'],
      {
        cwd: '/repo',
        commandResults: [],
      },
    )

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({
      ok: false,
      error: {
        kind: 'INPUT_ERROR',
        message:
          "error: unknown option '--definitely-not-a-real-flag'",
      },
    })
  })
})
