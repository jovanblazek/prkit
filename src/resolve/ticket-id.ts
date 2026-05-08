export function inferTicketId(
  branchName: string,
  pattern: RegExp,
): string | null {
  pattern.lastIndex = 0
  const match = pattern.exec(branchName)

  return match?.[1] ?? null
}
