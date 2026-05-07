import { describe, expect, it } from 'vitest'

import { getHelloWorld } from './index.js'

describe('getHelloWorld', () => {
  it('returns the hello world message', () => {
    expect(getHelloWorld()).toBe('Hello, world!')
  })
})
