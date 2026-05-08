import { describe, expect, it } from 'vitest'

import { buildTitle } from '../../src/resolve/title.js'

describe('buildTitle', () => {
  it('uses the default title format', () => {
    expect(
      buildTitle({
        ticketId: 'ABC-123',
        ticketTitle: 'Add resolution layer',
      }),
    ).toBe('ABC-123: Add resolution layer')
  })

  it('replaces placeholders in a custom title format', () => {
    expect(
      buildTitle({
        ticketId: 'ABC-123',
        ticketTitle: 'Add resolution layer',
        titleFormat: '[{ticketId}] {ticketTitle}',
      }),
    ).toBe('[ABC-123] Add resolution layer')
  })

  it('preserves placeholder-like input values literally', () => {
    expect(
      buildTitle({
        ticketId: '{ticketTitle}',
        ticketTitle: '{ticketId}',
      }),
    ).toBe('{ticketTitle}: {ticketId}')
  })
})
