import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { PrkitError } from '../../src/core/errors.js'
import { resolveBodySource } from '../../src/resolve/body-source.js'

describe('resolveBodySource', () => {
  it('fails when stdin and --body are both supplied', () => {
    expect(() =>
      resolveBodySource({
        body: 'inline',
        stdin: 'stdin body',
      }),
    ).toThrow(/Exactly one explicit body source/)
  })

  it('fails when --body and --body-file are both supplied', () => {
    expect(() =>
      resolveBodySource({
        body: 'inline',
        bodyFile: '/tmp/body.md',
      }),
    ).toThrow(/Exactly one explicit body source/)
  })

  it('fails when all explicit body sources are supplied', () => {
    expect(() =>
      resolveBodySource({
        body: 'inline',
        bodyFile: '/tmp/body.md',
        stdin: 'stdin body',
      }),
    ).toThrow(/Exactly one explicit body source/)
  })

  it('returns the explicit inline body', () => {
    expect(resolveBodySource({ body: 'inline body' })).toBe('inline body')
  })

  it('returns the explicit stdin body', () => {
    expect(resolveBodySource({ stdin: 'body from stdin' })).toBe(
      'body from stdin',
    )
  })

  it('reads the explicit body file', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'prkit-body-source-'))
    const file = path.join(dir, 'body.md')

    writeFileSync(file, 'body from file', 'utf8')

    expect(resolveBodySource({ bodyFile: file })).toBe('body from file')
  })

  it('falls back to the template path when no explicit source is supplied', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'prkit-body-source-'))
    const file = path.join(dir, 'template.md')

    writeFileSync(file, 'template body', 'utf8')

    expect(resolveBodySource({ templatePath: file })).toBe('template body')
  })

  it('returns an empty string when no body source is available', () => {
    expect(resolveBodySource({})).toBe('')
  })

  it('throws an input error kind for explicit source conflicts', () => {
    let thrown: unknown

    try {
      resolveBodySource({
        bodyFile: '/tmp/body.md',
        stdin: 'stdin body',
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(PrkitError)
    expect(thrown).toMatchObject({
      kind: 'INPUT_ERROR',
      message: 'Exactly one explicit body source may be supplied',
    })
  })
})
