import { describe, expect, it } from 'vitest'

import { runCli } from '../helpers/fakes.js'

describe('dry-run cli', () => {
  it('prints JSON only for non-interactive dry run', async () => {
    const result = await runCli(['create', '--non-interactive', '--dry-run'], {
      cwd: '/repo',
      commandResults: [],
      createPrResult: {
        ok: true,
        dryRun: true,
        created: false,
        ticketId: 'ENG-42',
        baseBranch: 'main',
        title: 'ENG-42: Build shared pipeline',
        reviewers: ['alice', 'bob'],
      },
    })

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe(
      `${JSON.stringify({
        ok: true,
        dryRun: true,
        created: false,
        ticketId: 'ENG-42',
        baseBranch: 'main',
        title: 'ENG-42: Build shared pipeline',
        reviewers: ['alice', 'bob'],
      })}\n`,
    )
  })
})
