export interface TicketProvider {
  getTicket(ticketId: string, cwd: string): Promise<{ id: string; title: string }>
}
