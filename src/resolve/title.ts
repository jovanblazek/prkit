export interface BuildTitleInput {
  ticketId: string
  ticketTitle: string
  titleFormat?: string
}

export function buildTitle(input: BuildTitleInput): string {
  const template = input.titleFormat ?? '{ticketId}: {ticketTitle}'
  const replacements = {
    ticketId: input.ticketId,
    ticketTitle: input.ticketTitle,
  }

  return template.replaceAll(
    /\{(ticketId|ticketTitle)\}/g,
    (_, key: keyof typeof replacements) => replacements[key],
  )
}
