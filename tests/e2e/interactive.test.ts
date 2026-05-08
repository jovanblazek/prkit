import { describe, expect, it } from 'vitest'

import { PrkitError } from '../../src/core/errors.js'
import { runCli } from '../helpers/fakes.js'

describe('interactive cli', () => {
  it('opens the body editor when no explicit body source is supplied', async () => {
    const result = await runCli(['create'], {
      cwd: '/repo',
      commandResults: [],
      editorCommand: 'code --wait',
      editorResult: 'PR body from editor',
      promptReplies: [{ confirmed: true }, { confirmed: true }],
      createPrResults: [
        {
          ok: true,
          dryRun: true,
          created: false,
          ticketId: 'ENG-42',
          baseBranch: 'main',
          title: 'ENG-42: Build shared pipeline',
          reviewers: [],
        },
        {
          ok: true,
          dryRun: false,
          created: true,
          ticketId: 'ENG-42',
          baseBranch: 'main',
          title: 'ENG-42: Build shared pipeline',
          reviewers: [],
          pr: {
            id: 'PR_eng-42',
            number: 42,
            url: 'https://example.com/pr/42',
          },
        },
      ],
    })

    expect(result.exitCode).toBe(0)
    expect(result.createPrCalls).toHaveLength(2)
    expect(result.createPrCalls[0]).toMatchObject({
      mode: 'interactive',
      dryRun: true,
      overrides: {
        body: 'PR body from editor',
      },
    })
    expect(result.createPrCalls[1]).toMatchObject({
      mode: 'interactive',
      dryRun: false,
      overrides: {
        body: 'PR body from editor',
      },
    })
    expect(result.promptCalls).toHaveLength(2)
    expect(result.promptCalls[0]).toMatchObject({
      type: 'confirm',
      message: 'Type PR body?',
      initial: true,
    })
  })

  it('falls back to VISUAL when EDITOR is not configured', async () => {
    const result = await runCli(['create'], {
      cwd: '/repo',
      commandResults: [],
      editorCommand: undefined,
      visualCommand: 'mate --wait',
      editorResult: 'PR body from visual',
      promptReplies: [{ confirmed: true }, { confirmed: true }],
      createPrResults: [
        {
          ok: true,
          dryRun: true,
          created: false,
          ticketId: 'ENG-42',
          baseBranch: 'main',
          title: 'ENG-42: Build shared pipeline',
          reviewers: [],
        },
        {
          ok: true,
          dryRun: false,
          created: true,
          ticketId: 'ENG-42',
          baseBranch: 'main',
          title: 'ENG-42: Build shared pipeline',
          reviewers: [],
          pr: {
            id: 'PR_eng-42',
            number: 42,
            url: 'https://example.com/pr/42',
          },
        },
      ],
    })

    expect(result.exitCode).toBe(0)
    expect(result.createPrCalls).toHaveLength(2)
    expect(result.createPrCalls[0]).toMatchObject({
      overrides: {
        body: 'PR body from visual',
      },
    })
  })

  it('falls back to vi when neither VISUAL nor EDITOR is configured', async () => {
    const result = await runCli(['create'], {
      cwd: '/repo',
      commandResults: [],
      editorCommand: undefined,
      visualCommand: undefined,
      editorResult: 'PR body from vi',
      promptReplies: [{ confirmed: true }, { confirmed: true }],
      createPrResults: [
        {
          ok: true,
          dryRun: true,
          created: false,
          ticketId: 'ENG-42',
          baseBranch: 'main',
          title: 'ENG-42: Build shared pipeline',
          reviewers: [],
        },
        {
          ok: true,
          dryRun: false,
          created: true,
          ticketId: 'ENG-42',
          baseBranch: 'main',
          title: 'ENG-42: Build shared pipeline',
          reviewers: [],
          pr: {
            id: 'PR_eng-42',
            number: 42,
            url: 'https://example.com/pr/42',
          },
        },
      ],
    })

    expect(result.exitCode).toBe(0)
    expect(result.createPrCalls).toHaveLength(2)
    expect(result.createPrCalls[0]).toMatchObject({
      overrides: {
        body: 'PR body from vi',
      },
    })
  })

  it('skips the body editor when the user declines typing a PR body', async () => {
    const result = await runCli(['create'], {
      cwd: '/repo',
      commandResults: [],
      editorCommand: 'code --wait',
      promptReplies: [{ confirmed: false }, { confirmed: true }],
      createPrResults: [
        {
          ok: true,
          dryRun: true,
          created: false,
          ticketId: 'ENG-42',
          baseBranch: 'main',
          title: 'ENG-42: Build shared pipeline',
          reviewers: [],
        },
        {
          ok: true,
          dryRun: false,
          created: true,
          ticketId: 'ENG-42',
          baseBranch: 'main',
          title: 'ENG-42: Build shared pipeline',
          reviewers: [],
          pr: {
            id: 'PR_eng-42',
            number: 42,
            url: 'https://example.com/pr/42',
          },
        },
      ],
    })

    expect(result.exitCode).toBe(0)
    expect(result.createPrCalls).toHaveLength(2)
    expect(result.createPrCalls[0]).toMatchObject({
      overrides: {},
    })
    expect(result.promptCalls).toHaveLength(2)
    expect(result.promptCalls[0]).toMatchObject({
      type: 'confirm',
      message: 'Type PR body?',
      initial: true,
    })
  })

  it('shows resolved fields before confirmation in interactive mode', async () => {
    const result = await runCli(['create'], {
      cwd: '/repo',
      commandResults: [],
      editorCommand: 'code --wait',
      promptReplies: [{ confirmed: true }, { confirmed: true }],
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
    expect(result.promptCalls).toHaveLength(2)
  })

  it('writes commander parse errors to stderr in interactive mode', async () => {
    const result = await runCli(['create', '--definitely-not-a-real-flag'], {
      cwd: '/repo',
      commandResults: [],
      editorCommand: 'code --wait',
    })

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain("error: unknown option '--definitely-not-a-real-flag'")
  })

  it('shows only the provider message in interactive mode when ticket loading fails', async () => {
    const result = await runCli(['create'], {
      cwd: '/repo',
      commandResults: [],
      editorCommand: 'code --wait',
      createPrError: new PrkitError(
        'PROVIDER_ERROR',
        'Failed to load Linear ticket. Make sure you are authenticated with Linear CLI.',
        {
          exitCode: 1,
          stderr:
            'Failed to view issue: No API key configured. Set LINEAR_API_KEY.',
        },
      ),
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe(
      'Failed to load Linear ticket. Make sure you are authenticated with Linear CLI.\n',
    )
  })
})
