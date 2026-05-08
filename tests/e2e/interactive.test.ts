import { describe, expect, it } from 'vitest'

import { runCli } from '../helpers/fakes.js'

describe('interactive cli', () => {
  it('shows resolved fields before confirmation in interactive mode', async () => {
    const result = await runCli(['create'], {
      cwd: '/repo',
      commandResults: [],
      promptReplies: [{ confirmed: true }],
      createPrResults: [
        {
          ok: true,
          dryRun: true,
          created: false,
          ticketId: 'ENG-42',
          baseBranch: 'main',
          title: 'ENG-42: Build shared pipeline',
          reviewers: ['alice', 'bob'],
        },
        {
          ok: true,
          dryRun: false,
          created: true,
          ticketId: 'ENG-42',
          baseBranch: 'main',
          title: 'ENG-42: Build shared pipeline',
          reviewers: ['alice', 'bob'],
          pr: {
            id: 'PR_eng-42',
            number: 42,
            url: 'https://example.com/pr/42',
          },
        },
      ],
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Ticket: ENG-42')
    expect(result.stdout).toContain('Base branch: main')
    expect(result.stdout).toContain('Reviewers: alice, bob')
    expect(result.createPrCalls).toHaveLength(2)
    expect(result.createPrCalls[0]).toMatchObject({
      mode: 'interactive',
      dryRun: true,
      cwd: '/repo',
    })
    expect(result.createPrCalls[1]).toMatchObject({
      mode: 'interactive',
      dryRun: false,
      cwd: '/repo',
    })
    expect(result.promptCalls).toHaveLength(1)
  })

  it('writes commander parse errors to stderr in interactive mode', async () => {
    const result = await runCli(['create', '--definitely-not-a-real-flag'], {
      cwd: '/repo',
      commandResults: [],
    })

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain("error: unknown option '--definitely-not-a-real-flag'")
  })
})
