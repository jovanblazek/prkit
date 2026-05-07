import { describe, expect, it } from 'vitest'

import { PrkitError, main } from './index.js'

describe('index exports', () => {
  it('re-exports the cli main entrypoint', async () => {
    await expect(main(['create', '--non-interactive'])).resolves.toBe(1)
  })

  it('re-exports the core error type', () => {
    const error = new PrkitError('ENVIRONMENT_ERROR', 'missing repo')

    expect(error.kind).toBe('ENVIRONMENT_ERROR')
    expect(error.message).toBe('missing repo')
  })
})
