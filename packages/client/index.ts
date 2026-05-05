/**
 * The client for Minecraft protocol. I can create the connection with Minecraft server and ping the server status.
 *
 * You can use {@link queryStatus} with {@link QueryOptions} to ping a {@link Status} of a server
 *
 * @packageDocumentation
 * @module @xmcl/client
 */

export * from './coders'
export * from './packet'
export * from './channel'
export * from './status'
export * from './lan'
