import { minimatch } from 'minimatch'

export interface ReviewerRule {
  pattern: string
  reviewers: string[]
}

export interface ResolveReviewersInput {
  changedFiles: string[]
  defaultReviewers: string[]
  rules: ReviewerRule[]
  author?: string
  assignee?: string
}

export function resolveReviewers(input: ResolveReviewersInput): string[] {
  const reviewers = new Set<string>()
  const excluded = new Set(
    [input.author, input.assignee].filter(
      (value): value is string => value !== undefined,
    ),
  )

  for (const reviewer of input.defaultReviewers) {
    reviewers.add(reviewer)
  }

  for (const rule of input.rules) {
    const matchesRule = input.changedFiles.some((file) =>
      minimatch(file, rule.pattern),
    )

    if (!matchesRule) {
      continue
    }

    for (const reviewer of rule.reviewers) {
      reviewers.add(reviewer)
    }
  }

  return [...reviewers].filter((reviewer) => !excluded.has(reviewer))
}
