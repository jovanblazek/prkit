import { describe, expect, it } from 'vitest'

import { runCli } from '../helpers/fakes.js'

describe('cli smoke', () => {
  it('prints stable JSON for non-interactive usage errors', async () => {
    const result = await runCli(['create', '--non-interactive'], {
      cwd: '/repo',
      commandResults: [],
    })

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      error: {
        kind: 'ENVIRONMENT_ERROR',
      },
    })
  })
})
