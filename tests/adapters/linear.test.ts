import { describe, expect, it } from 'vitest'

import { PrkitError } from '../../src/core/errors.js'
import { LinearTicketProvider } from '../../src/ticketing/linear.js'
import { createFakeRunner } from '../helpers/fakes.js'

describe('LinearTicketProvider', () => {
  it('loads a ticket via linear issue view and normalizes the result', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['linear', 'issue', 'view', 'ENG-123', '--json'],
        stdout: JSON.stringify({
          identifier: 'ENG-123',
          title: 'Fix flaky integration test',
        }),
      },
    ])

    const provider = new LinearTicketProvider(runner)

    await expect(provider.getTicket('ENG-123', '/repo')).resolves.toEqual({
      id: 'ENG-123',
      title: 'Fix flaky integration test',
    })

    runner.assertComplete()
  })

  it('fails when linear exits nonzero', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['linear', 'issue', 'view', 'ENG-123', '--json'],
        stderr: 'Issue not found\n',
        exitCode: 1,
      },
    ])

    const provider = new LinearTicketProvider(runner)

    await expect(provider.getTicket('ENG-123', '/repo')).rejects.toEqual(
      new PrkitError(
        'PROVIDER_ERROR',
        'failed to load Linear ticket',
        expect.objectContaining({
          exitCode: 1,
          stderr: 'Issue not found',
        }),
      ),
    )

    runner.assertComplete()
  })

  it('fails when linear returns malformed json', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['linear', 'issue', 'view', 'ENG-123', '--json'],
        stdout: '{not-json',
      },
    ])

    const provider = new LinearTicketProvider(runner)

    await expect(provider.getTicket('ENG-123', '/repo')).rejects.toEqual(
      new PrkitError('PROVIDER_ERROR', 'received invalid Linear ticket response'),
    )

    runner.assertComplete()
  })

  it('fails when linear omits required ticket fields', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['linear', 'issue', 'view', 'ENG-123', '--json'],
        stdout: JSON.stringify({
          id: 'ENG-123',
          title: 123,
        }),
      },
    ])

    const provider = new LinearTicketProvider(runner)

    await expect(provider.getTicket('ENG-123', '/repo')).rejects.toEqual(
      new PrkitError('PROVIDER_ERROR', 'received invalid Linear ticket response'),
    )

    runner.assertComplete()
  })

  it('fails when linear returns blank required ticket fields', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['linear', 'issue', 'view', 'ENG-123', '--json'],
        stdout: JSON.stringify({
          identifier: '   ',
          title: '',
        }),
      },
    ])

    const provider = new LinearTicketProvider(runner)

    await expect(provider.getTicket('ENG-123', '/repo')).rejects.toEqual(
      new PrkitError('PROVIDER_ERROR', 'received invalid Linear ticket response'),
    )

    runner.assertComplete()
  })
})
