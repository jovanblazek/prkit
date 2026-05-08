import { describe, expect, it } from 'vitest'

import { PrkitError } from '../../src/core/errors.js'
import { LinearTicketProvider } from '../../src/ticketing/linear.js'
import { createFakeRunner } from '../helpers/fakes.js'

function createProvider(commandResult: {
  stdout?: string
  stderr?: string
  exitCode?: number
}) {
  const runner = createFakeRunner([
    {
      cwd: '/repo',
      args: ['linear', 'issue', 'view', 'ENG-123', '--json'],
      ...commandResult,
    },
  ])

  return {
    runner,
    provider: new LinearTicketProvider(runner),
  }
}

async function expectInvalidTicketResponse(stdout: string): Promise<void> {
  const { runner, provider } = createProvider({ stdout })

  await expect(provider.getTicket('ENG-123', '/repo')).rejects.toEqual(
    new PrkitError('PROVIDER_ERROR', 'Received invalid Linear ticket response.'),
  )

  runner.assertComplete()
}

describe('LinearTicketProvider', () => {
  it('loads a ticket via linear issue view and normalizes the result', async () => {
    const { runner, provider } = createProvider({
      stdout: JSON.stringify({
        identifier: 'ENG-123',
        title: 'Fix flaky integration test',
      }),
    })

    await expect(provider.getTicket('ENG-123', '/repo')).resolves.toEqual({
      id: 'ENG-123',
      title: 'Fix flaky integration test',
    })

    runner.assertComplete()
  })

  it('fails when linear exits nonzero', async () => {
    const { runner, provider } = createProvider({
      stderr: 'Issue not found\n',
      exitCode: 1,
    })

    await expect(provider.getTicket('ENG-123', '/repo')).rejects.toEqual(
      new PrkitError(
        'PROVIDER_ERROR',
        'Failed to load Linear ticket. Make sure you are authenticated with Linear CLI.\nSet LINEAR_API_KEY, add api_key to .linear.toml, or run `linear auth login`.',
        expect.objectContaining({
          exitCode: 1,
          stderr: 'Issue not found',
        }),
      ),
    )

    runner.assertComplete()
  })

  it('fails when linear returns malformed json', async () => {
    const { runner, provider } = createProvider({ stdout: '{not-json' })

    await expect(provider.getTicket('ENG-123', '/repo')).rejects.toEqual(
      new PrkitError('PROVIDER_ERROR', 'Unable to parse Linear ticket response.'),
    )

    runner.assertComplete()
  })

  it('fails when linear omits required ticket fields', async () => {
    await expectInvalidTicketResponse(
      JSON.stringify({
        id: 'ENG-123',
        title: 123,
      }),
    )
  })

  it('fails when linear returns blank required ticket fields', async () => {
    await expectInvalidTicketResponse(
      JSON.stringify({
        identifier: '   ',
        title: '',
      }),
    )
  })
})
