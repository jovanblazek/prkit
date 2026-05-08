export interface CreatePullRequestInput {
  baseBranch: string
  title: string
  body: string
  reviewers: string[]
  assignee?: string
  draft?: boolean
}

export interface PrProvider {
  getAuthenticatedUser(cwd: string): Promise<string>
  createPullRequest(
    cwd: string,
    input: CreatePullRequestInput,
  ): Promise<{ id: string; number: number; url: string }>
}
