export interface CreatePullRequestInput {
  baseBranch: string
  title: string
  body: string
  reviewers: string[]
  assignToCurrentUser?: boolean
  draft?: boolean
}

export interface PrProvider {
  createPullRequest(
    cwd: string,
    input: CreatePullRequestInput,
  ): Promise<{ id: string; number: number; url: string }>
}
