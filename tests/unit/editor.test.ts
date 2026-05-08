import { describe, expect, it, vi } from 'vitest'

import { resolveEditorCommand } from '../../src/cli/editor.js'

describe('resolveEditorCommand', () => {
  it('prefers the explicit editor command argument', () => {
    expect(resolveEditorCommand('code --wait')).toBe('code --wait')
  })

  it('falls back to VISUAL before EDITOR', () => {
    const originalVisual = process.env.VISUAL
    const originalEditor = process.env.EDITOR

    process.env.VISUAL = 'mate --wait'
    process.env.EDITOR = 'nano'

    try {
      expect(resolveEditorCommand()).toBe('mate --wait')
    } finally {
      if (originalVisual === undefined) {
        delete process.env.VISUAL
      } else {
        process.env.VISUAL = originalVisual
      }

      if (originalEditor === undefined) {
        delete process.env.EDITOR
      } else {
        process.env.EDITOR = originalEditor
      }
    }
  })

  it('falls back to vi when no editor environment variables are set', () => {
    const originalVisual = process.env.VISUAL
    const originalEditor = process.env.EDITOR

    delete process.env.VISUAL
    delete process.env.EDITOR

    try {
      expect(resolveEditorCommand()).toBe('vi')
    } finally {
      if (originalVisual === undefined) {
        delete process.env.VISUAL
      } else {
        process.env.VISUAL = originalVisual
      }

      if (originalEditor === undefined) {
        delete process.env.EDITOR
      } else {
        process.env.EDITOR = originalEditor
      }
    }
  })
})
