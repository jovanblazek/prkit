import { describe, expect, it, vi } from 'vitest'

import { PrkitError } from './index.js'

describe('index exports', () => {
  it('re-exports the cli main entrypoint', async () => {
    vi.resetModules()
    vi.doMock('./pipeline/create-pr.js', () => ({
      createPr: vi.fn().mockResolvedValue({
        ok: true,
        dryRun: true,
        created: false,
        ticketId: 'ENG-42',
        baseBranch: 'main',
        title: 'ENG-42: Build shared pipeline',
        reviewers: [],
      }),
    }))
    const stdin = vi.spyOn(process, 'stdin', 'get').mockReturnValue({
      isTTY: true,
    } as typeof process.stdin)

    try {
      const { main } = await import('./index.js')
      await expect(main(['create', '--non-interactive', '--dry-run'])).resolves.toBe(0)
    } finally {
      vi.doUnmock('./pipeline/create-pr.js')
      stdin.mockRestore()
    }
  })

  it('re-exports the core error type', () => {
    const error = new PrkitError('ENVIRONMENT_ERROR', 'missing repo')

    expect(error.kind).toBe('ENVIRONMENT_ERROR')
    expect(error.message).toBe('missing repo')
  })
})
