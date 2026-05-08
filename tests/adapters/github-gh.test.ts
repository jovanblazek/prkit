import { describe, expect, it } from 'vitest'

import { PrkitError } from '../../src/core/errors.js'
import { GitHubGhPrProvider } from '../../src/pr/github-gh.js'
import { createFakeRunner } from '../helpers/fakes.js'

describe('GitHubGhPrProvider', () => {
  it('reads the authenticated GitHub user', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['gh', 'api', 'user', '--jq', '.login'],
        stdout: 'octocat\n',
      },
    ])

    const provider = new GitHubGhPrProvider(runner)

    await expect(provider.getAuthenticatedUser('/repo')).resolves.toBe('octocat')

    runner.assertComplete()
  })

  it('fails when the authenticated GitHub user is blank', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['gh', 'api', 'user', '--jq', '.login'],
        stdout: '   \n',
      },
    ])

    const provider = new GitHubGhPrProvider(runner)

    await expect(provider.getAuthenticatedUser('/repo')).rejects.toEqual(
      new PrkitError('PROVIDER_ERROR', 'received invalid authenticated GitHub user'),
    )

    runner.assertComplete()
  })

  it('fails when gh returns malformed scalar authenticated user output', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: ['gh', 'api', 'user', '--jq', '.login'],
        stdout: 'null\n',
      },
    ])

    const provider = new GitHubGhPrProvider(runner)

    await expect(provider.getAuthenticatedUser('/repo')).rejects.toEqual(
      new PrkitError('PROVIDER_ERROR', 'received invalid authenticated GitHub user'),
    )

    runner.assertComplete()
  })

  it('creates a pull request with optional reviewers assignee and draft flag', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: [
          'gh',
          'pr',
          'create',
          '--base',
          'main',
          '--title',
          'feat: add provider adapters',
          '--body',
          'Implements Task 5.',
          '--assignee',
          'octocat',
          '--reviewer',
          'alice,bob',
          '--draft',
          '--json',
          'number,url,id',
        ],
        stdout: JSON.stringify({
          id: 'PR_kwDOAA',
          number: 42,
          url: 'https://github.com/org/repo/pull/42',
        }),
      },
    ])

    const provider = new GitHubGhPrProvider(runner)

    await expect(
      provider.createPullRequest('/repo', {
        baseBranch: 'main',
        title: 'feat: add provider adapters',
        body: 'Implements Task 5.',
        assignee: 'octocat',
        reviewers: ['alice', 'bob'],
        draft: true,
      }),
    ).resolves.toEqual({
      id: 'PR_kwDOAA',
      number: 42,
      url: 'https://github.com/org/repo/pull/42',
    })

    runner.assertComplete()
  })

  it('omits optional create flags when assignee reviewers and draft are unset', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: [
          'gh',
          'pr',
          'create',
          '--base',
          'develop',
          '--title',
          'fix: trim output',
          '--body',
          'Body text',
          '--json',
          'number,url,id',
        ],
        stdout: JSON.stringify({
          id: 'PR_kwDOBB',
          number: 7,
          url: 'https://github.com/org/repo/pull/7',
        }),
      },
    ])

    const provider = new GitHubGhPrProvider(runner)

    await expect(
      provider.createPullRequest('/repo', {
        baseBranch: 'develop',
        title: 'fix: trim output',
        body: 'Body text',
        reviewers: [],
        draft: false,
      }),
    ).resolves.toEqual({
      id: 'PR_kwDOBB',
      number: 7,
      url: 'https://github.com/org/repo/pull/7',
    })

    runner.assertComplete()
  })

  it('fails when gh pr create exits nonzero', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: [
          'gh',
          'pr',
          'create',
          '--base',
          'main',
          '--title',
          'feat: add provider adapters',
          '--body',
          'Implements Task 5.',
          '--json',
          'number,url,id',
        ],
        stderr: 'GraphQL: validation failed\n',
        exitCode: 1,
      },
    ])

    const provider = new GitHubGhPrProvider(runner)

    await expect(
      provider.createPullRequest('/repo', {
        baseBranch: 'main',
        title: 'feat: add provider adapters',
        body: 'Implements Task 5.',
        reviewers: [],
        draft: false,
      }),
    ).rejects.toEqual(
      new PrkitError(
        'PROVIDER_ERROR',
        'Failed to create GitHub pull request.',
        expect.objectContaining({
          exitCode: 1,
          stderr: 'GraphQL: validation failed',
        }),
      ),
    )

    runner.assertComplete()
  })

  it('fails when gh pr create returns malformed json', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: [
          'gh',
          'pr',
          'create',
          '--base',
          'main',
          '--title',
          'feat: add provider adapters',
          '--body',
          'Implements Task 5.',
          '--json',
          'number,url,id',
        ],
        stdout: '{"id":',
      },
    ])

    const provider = new GitHubGhPrProvider(runner)

    await expect(
      provider.createPullRequest('/repo', {
        baseBranch: 'main',
        title: 'feat: add provider adapters',
        body: 'Implements Task 5.',
        reviewers: [],
        draft: false,
      }),
    ).rejects.toEqual(
      new PrkitError(
        'PROVIDER_ERROR',
        'Received invalid GitHub pull request response.',
      ),
    )

    runner.assertComplete()
  })

  it('fails when gh pr create omits required response fields', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: [
          'gh',
          'pr',
          'create',
          '--base',
          'main',
          '--title',
          'feat: add provider adapters',
          '--body',
          'Implements Task 5.',
          '--json',
          'number,url,id',
        ],
        stdout: JSON.stringify({
          id: 'PR_kwDOAA',
          number: '42',
        }),
      },
    ])

    const provider = new GitHubGhPrProvider(runner)

    await expect(
      provider.createPullRequest('/repo', {
        baseBranch: 'main',
        title: 'feat: add provider adapters',
        body: 'Implements Task 5.',
        reviewers: [],
        draft: false,
      }),
    ).rejects.toEqual(
      new PrkitError(
        'PROVIDER_ERROR',
        'Received invalid GitHub pull request response.',
      ),
    )

    runner.assertComplete()
  })

  it('fails when gh pr create returns blank required string fields', async () => {
    const runner = createFakeRunner([
      {
        cwd: '/repo',
        args: [
          'gh',
          'pr',
          'create',
          '--base',
          'main',
          '--title',
          'feat: add provider adapters',
          '--body',
          'Implements Task 5.',
          '--json',
          'number,url,id',
        ],
        stdout: JSON.stringify({
          id: '   ',
          number: 42,
          url: '',
        }),
      },
    ])

    const provider = new GitHubGhPrProvider(runner)

    await expect(
      provider.createPullRequest('/repo', {
        baseBranch: 'main',
        title: 'feat: add provider adapters',
        body: 'Implements Task 5.',
        reviewers: [],
        draft: false,
      }),
    ).rejects.toEqual(
      new PrkitError(
        'PROVIDER_ERROR',
        'Received invalid GitHub pull request response.',
      ),
    )

    runner.assertComplete()
  })
})
