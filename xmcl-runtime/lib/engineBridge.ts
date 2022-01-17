/**
 * Represent a long lived connection between the main process (server) and renderer process (client)
 */
export interface Client {
  send(channel: string, ...payload: any[]): void
}
