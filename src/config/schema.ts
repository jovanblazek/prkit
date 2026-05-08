import { z } from 'zod'

const reviewerRuleSchema = z
  .object({
    pattern: z.string().min(1),
    reviewers: z.array(z.string().min(1)),
  })
  .strict()

export const configSchema = z
  .object({
    ticketProvider: z.literal('linear').default('linear'),
    ticketBranchPattern: z.string().min(1),
    baseBranch: z.string().min(1),
    titleFormat: z.string().min(1).optional(),
    descriptionTemplatePath: z.string().min(1).optional(),
    defaultReviewers: z.array(z.string().min(1)).default([]),
    reviewerRules: z.array(reviewerRuleSchema).default([]),
    draftByDefault: z.boolean().default(false),
    assignToCurrentUser: z.boolean().default(true),
  })
  .strict()

export type ReviewerRule = z.infer<typeof reviewerRuleSchema>
export type PrkitConfig = z.infer<typeof configSchema>
