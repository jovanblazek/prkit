import { describe, expect, it } from 'vitest'

import { inferTicketId } from '../../src/resolve/ticket-id.js'

describe('inferTicketId', () => {
  it('extracts one ticket capture from branch name', () => {
    expect(
      inferTicketId('feature/ABC-123-add-prkit', /([A-Z]+-\d+)/),
    ).toBe('ABC-123')
  })

  it('returns the first capture group for global regex patterns', () => {
    expect(
      inferTicketId('feature/ABC-123-add-prkit', /([A-Z]+-\d+)/g),
    ).toBe('ABC-123')
  })

  it('returns null when the branch does not match', () => {
    expect(inferTicketId('main', /([A-Z]+-\d+)/)).toBeNull()
  })
})
