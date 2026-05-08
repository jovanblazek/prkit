import { describe, expect, it, vi } from 'vitest'

import { createPr } from '../../src/pipeline/create-pr.js'
import { PrkitError } from '../../src/core/errors.js'

describe('createPr pipeline', () => {
  it('returns a dry-run result without remote mutation', async () => {
    const getRepositoryContext = vi.fn().mockResolvedValue({
      rootDir: '/repo',
      branchName: 'feature/ENG-42-add-pipeline',
      originUrl: 'git@github.com:acme/prkit.git',
    })
    const loadConfig = vi.fn().mockResolvedValue({
      ticketProvider: 'linear',
      ticketBranchPattern: '^feature/(ENG-\\d+)-',
      baseBranch: 'main',
      titleFormat: '{ticketId}: {ticketTitle}',
      defaultReviewers: ['alice'],
      reviewerRules: [{ pattern: 'src/pipeline/**', reviewers: ['bob'] }],
      draftByDefault: false,
      assignToCurrentUser: false,
    })
    const getChangedFiles = vi
      .fn()
      .mockResolvedValue(['src/pipeline/create-pr.ts', 'README.md'])
    const getTicket = vi
      .fn()
      .mockResolvedValue({ id: 'ENG-42', title: 'Build shared pipeline' })
    const isBranchPushed = vi.fn()
    const createPullRequest = vi.fn()

    const result = await createPr({
      mode: 'non-interactive',
      dryRun: true,
      cwd: '/repo',
      overrides: {},
      deps: {
        git: {
          getRepositoryContext,
          getChangedFiles,
          isBranchPushed,
        },
        config: { load: loadConfig },
        ticketProvider: { getTicket },
        prProvider: {
          getAuthenticatedUser: vi.fn(),
          createPullRequest,
        },
      },
    })

    expect(result).toMatchObject({
      ok: true,
      dryRun: true,
      created: false,
      ticketId: 'ENG-42',
      baseBranch: 'main',
      title: 'ENG-42: Build shared pipeline',
      reviewers: ['alice', 'bob'],
    })
    expect(result).not.toHaveProperty('assignee')
    expect(result).not.toHaveProperty('pr')
    expect(createPullRequest).not.toHaveBeenCalled()
    expect(isBranchPushed).not.toHaveBeenCalled()
    expect(getRepositoryContext).toHaveBeenCalledWith('/repo')
    expect(loadConfig).toHaveBeenCalledWith('/repo')
    expect(getChangedFiles).toHaveBeenCalledWith('/repo', 'main')
  })

  it('returns a created result with a required pr payload', async () => {
    const createPullRequest = vi.fn().mockResolvedValue({
      id: 'PR_kwDOAA',
      number: 17,
      url: 'https://github.com/acme/prkit/pull/17',
    })

    const result = await createPr({
      mode: 'non-interactive',
      dryRun: false,
      cwd: '/repo',
      overrides: { ticketId: 'ENG-42' },
      deps: {
        git: {
          getRepositoryContext: vi.fn().mockResolvedValue({
            rootDir: '/repo',
            branchName: 'feature/ENG-42-add-pipeline',
            originUrl: 'git@github.com:acme/prkit.git',
          }),
          getChangedFiles: vi.fn().mockResolvedValue([]),
          isBranchPushed: vi.fn().mockResolvedValue(true),
        },
        config: {
          load: vi.fn().mockResolvedValue({
            ticketProvider: 'linear',
            ticketBranchPattern: '^feature/(ENG-\\d+)-',
            baseBranch: 'main',
            defaultReviewers: [],
            reviewerRules: [],
            draftByDefault: true,
            assignToCurrentUser: false,
          }),
        },
        ticketProvider: {
          getTicket: vi
            .fn()
            .mockResolvedValue({ id: 'ENG-42', title: 'Build shared pipeline' }),
        },
        prProvider: {
          getAuthenticatedUser: vi.fn(),
          createPullRequest,
        },
      },
    })

    expect(result).toEqual({
      ok: true,
      dryRun: false,
      created: true,
      ticketId: 'ENG-42',
      baseBranch: 'main',
      title: 'ENG-42: Build shared pipeline',
      reviewers: [],
      pr: {
        id: 'PR_kwDOAA',
        number: 17,
        url: 'https://github.com/acme/prkit/pull/17',
      },
    })
    expect(createPullRequest).toHaveBeenCalledWith('/repo', {
      baseBranch: 'main',
      title: 'ENG-42: Build shared pipeline',
      body: '',
      reviewers: [],
    })
  })

  it('uses repo rootDir for config and downstream operations', async () => {
    const getChangedFiles = vi.fn().mockResolvedValue([])
    const getTicket = vi
      .fn()
      .mockResolvedValue({ id: 'ENG-42', title: 'Build shared pipeline' })
    const createPullRequest = vi.fn().mockResolvedValue({
      id: 'PR_kwDOAA',
      number: 18,
      url: 'https://github.com/acme/prkit/pull/18',
    })
    const load = vi.fn().mockResolvedValue({
      ticketProvider: 'linear',
      ticketBranchPattern: '^feature/(ENG-\\d+)-',
      baseBranch: 'main',
      defaultReviewers: [],
      reviewerRules: [],
      draftByDefault: false,
      assignToCurrentUser: false,
    })

    await createPr({
      mode: 'non-interactive',
      dryRun: false,
      cwd: '/repo/packages/cli',
      overrides: { ticketId: 'ENG-42' },
      deps: {
        git: {
          getRepositoryContext: vi.fn().mockResolvedValue({
            rootDir: '/repo',
            branchName: 'feature/ENG-42-add-pipeline',
            originUrl: 'git@github.com:acme/prkit.git',
          }),
          getChangedFiles,
          isBranchPushed: vi.fn().mockResolvedValue(true),
        },
        config: { load },
        ticketProvider: { getTicket },
        prProvider: {
          getAuthenticatedUser: vi.fn(),
          createPullRequest,
        },
      },
    })

    expect(load).toHaveBeenCalledWith('/repo')
    expect(getTicket).toHaveBeenCalledWith('ENG-42', '/repo')
    expect(getChangedFiles).toHaveBeenCalledWith('/repo', 'main')
    expect(createPullRequest).toHaveBeenCalledWith('/repo', {
      baseBranch: 'main',
      title: 'ENG-42: Build shared pipeline',
      body: '',
      reviewers: [],
    })
  })

  it('fails when the branch is not pushed for a real create', async () => {
    await expect(
      createPr({
        mode: 'non-interactive',
        dryRun: false,
        cwd: '/repo',
        overrides: { ticketId: 'ENG-42' },
        deps: {
          git: {
            getRepositoryContext: vi.fn().mockResolvedValue({
              rootDir: '/repo',
              branchName: 'feature/ENG-42-add-pipeline',
              originUrl: 'git@github.com:acme/prkit.git',
            }),
            getChangedFiles: vi.fn().mockResolvedValue([]),
            isBranchPushed: vi.fn().mockResolvedValue(false),
          },
          config: {
            load: vi.fn().mockResolvedValue({
              ticketProvider: 'linear',
              ticketBranchPattern: '^feature/(ENG-\\d+)-',
              baseBranch: 'main',
              defaultReviewers: [],
              reviewerRules: [],
              draftByDefault: false,
              assignToCurrentUser: false,
            }),
          },
          ticketProvider: {
            getTicket: vi
              .fn()
              .mockResolvedValue({ id: 'ENG-42', title: 'Build shared pipeline' }),
          },
          prProvider: {
            getAuthenticatedUser: vi.fn(),
            createPullRequest: vi.fn(),
          },
        },
      }),
    ).rejects.toMatchObject(
      new PrkitError(
        'INPUT_ERROR',
        'Current branch must be pushed before PR creation',
      ),
    )
  })
})
