import { describe, expect, it } from 'vitest'

import { resolveReviewers } from '../../src/resolve/reviewers.js'

describe('resolveReviewers', () => {
  it('dedupes reviewers and removes author plus assignee', () => {
    expect(
      resolveReviewers({
        changedFiles: ['src/cli/main.ts', 'src/pr/github-gh.ts'],
        defaultReviewers: ['alice', 'bob'],
        rules: [
          { pattern: 'src/cli/**', reviewers: ['carol', 'alice'] },
          { pattern: 'src/pr/**', reviewers: ['dave', 'bob'] },
        ],
        author: 'alice',
        assignee: 'dave',
      }),
    ).toEqual(['bob', 'carol'])
  })

  it('only includes reviewers from rules that match changed files', () => {
    expect(
      resolveReviewers({
        changedFiles: ['src/resolve/title.ts'],
        defaultReviewers: [],
        rules: [
          { pattern: 'src/resolve/**', reviewers: ['alice'] },
          { pattern: 'docs/**', reviewers: ['bob'] },
        ],
      }),
    ).toEqual(['alice'])
  })

  it('preserves deterministic order from defaults before matching rules', () => {
    expect(
      resolveReviewers({
        changedFiles: ['src/resolve/title.ts', 'src/cli/main.ts'],
        defaultReviewers: ['carol', 'alice'],
        rules: [
          { pattern: 'src/resolve/**', reviewers: ['bob', 'alice'] },
          { pattern: 'src/cli/**', reviewers: ['dave', 'bob'] },
        ],
      }),
    ).toEqual(['carol', 'alice', 'bob', 'dave'])
  })
})
