/**
 * Represent a long lived connection between the main process (server) and renderer process (client)
 */
export interface Client {
  isDestroyed(): boolean

  on(event: 'destroyed', listener: () => void): this
  removeListener(event: 'destroyed', listener: () => void): this
  /**
   * Send the message to the client in a specific channel
   */
  send(channel: string, ...payload: any[]): void
}
