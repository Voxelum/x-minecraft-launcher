/**
 * Represent a long lived connection between the main process (server) and renderer process (client)
 */
export interface Client {
  /**
   * Send the message to the client in a specific channel
   */
  send(channel: string, ...payload: any[]): void
}
