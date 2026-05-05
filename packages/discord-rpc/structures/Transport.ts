import { type TypedEmitter } from '../utils/TypedEmitter'
import { EventEmitter } from 'node:events'
import type { Client } from '../Client'

export enum RPC_CLOSE_CODE {
  RPC_CLOSE_NORMAL = 1000,
  RPC_CLOSE_UNSUPPORTED = 1003,
  RPC_CLOSE_ABNORMAL = 1006,

  /**
   * You connected to the RPC server with an invalid client ID.
   */
  RPC_CLOSE_INVALID_CLIENT_ID = 4000,
  /**
   * You connected to the RPC server with an invalid origin.
   */
  RPC_CLOSE_INVALID_ORIGIN = 4001,
  /**
   * You are being rate limited.
   */
  RPC_CLOSE_RATE_LIMITED = 4002,
  /**
   * The OAuth2 token associated with a connection was revoked, get a new one!
   */
  RPC_CLOSE_TOKEN_REVOKED = 4003,
  /**
   * The RPC Server version specified in the connection string was not valid.
   */
  RPC_CLOSE_INVALID_VERSION = 4004,
  /**
   * The encoding specified in the connection string was not valid
   */
  RPC_CLOSE_INVALID_ENCODING = 4005,
}

export enum RPC_ERROR_CODE {
  /**
   * An unknown error occurred.
   */
  RPC_UNKNOWN_ERROR = 1000,
  /**
   * You sent an invalid payload.
   */
  RPC_INVALID_PAYLOAD = 4000,
  /**
   * Invalid command name specified.
   */
  RPC_INVALID_COMMAND = 4002,
  /**
   * Invalid guild ID specified.
   */
  RPC_INVALID_GUILD = 4003,
  /**
   * Invalid event name specified.
   */
  RPC_INVALID_EVENT = 4004,
  /**
   * Invalid channel ID specified.
   */
  RPC_INVALID_CHANNEL = 4005,
  /**
   * You lack permissions to access the given resource.
   */
  RPC_INVALID_PERMISSION = 4006,
  /**
   * An invalid OAuth2 application ID was used to authorize or authenticate with.
   */
  RPC_INVALID_CLIENT_ID = 4007,
  /**
   * An invalid OAuth2 application origin was used to authorize or authenticate with.
   */
  RPC_INVALID_ORIGIN = 4008,
  /**
   * An invalid OAuth2 token was used to authorize or authenticate with.
   */
  RPC_INVALID_TOKEN = 4009,
  /**
   * The specified user ID was invalid.
   */
  RPC_INVALID_USER = 4010,
  /**
   * A standard OAuth2 error occurred; check the data object for the OAuth2 error details.
   */
  RPC_OAUTH2_ERROR = 5000,
  /**
   * An asynchronous `SELECT_TEXT_CHANNEL`/`SELECT_VOICE_CHANNEL` command timed out.
   */
  RPC_SELECT_CHANNEL_TIMEOUT = 5001,
  /**
   * An asynchronous `GET_GUILD` command timed out.
   */
  RPC_GET_GUILD_TIMEOUT = 5002,
  /**
   * You tried to join a user to a voice channel but the user was already in one.
   */
  RPC_SELECT_VOICE_FORCE_REQUIRED = 5003,
  /**
   * You tried to capture more than one shortcut key at once.
   */
  RPC_CAPTURE_SHORTCUT_ALREADY_LISTENING = 5004,
}

export enum CUSTOM_RPC_ERROR_CODE {
  RPC_CONNECTION_ENDED,
  RPC_CONNECTION_TIMEOUT,
  RPC_COULD_NOT_CONNECT,
}

export type RPC_CMD =
  | 'DISPATCH'
  | 'SET_CONFIG'
  | 'AUTHORIZE'
  | 'AUTHENTICATE'
  | 'GET_GUILD'
  | 'GET_GUILDS'
  | 'GET_CHANNEL'
  | 'GET_CHANNELS'
  | 'CREATE_CHANNEL_INVITE'
  | 'GET_RELATIONSHIPS'
  | 'GET_USER'
  | 'SUBSCRIBE'
  | 'UNSUBSCRIBE'
  | 'SET_USER_VOICE_SETTINGS'
  | 'SET_USER_VOICE_SETTINGS_2'
  | 'SELECT_VOICE_CHANNEL'
  | 'GET_SELECTED_VOICE_CHANNEL'
  | 'SELECT_TEXT_CHANNEL'
  | 'GET_VOICE_SETTINGS'
  | 'SET_VOICE_SETTINGS_2'
  | 'SET_VOICE_SETTINGS'
  | 'SET_ACTIVITY'
  | 'SEND_ACTIVITY_JOIN_INVITE'
  | 'CLOSE_ACTIVITY_JOIN_REQUEST'
  | 'ACTIVITY_INVITE_USER'
  | 'ACCEPT_ACTIVITY_INVITE'
  | 'OPEN_INVITE_DIALOG'
  | 'INVITE_BROWSER'
  | 'DEEP_LINK'
  | 'CONNECTIONS_CALLBACK'
  | 'BILLING_POPUP_BRIDGE_CALLBACK'
  | 'BRAINTREE_POPUP_BRIDGE_CALLBACK'
  | 'GIFT_CODE_BROWSER'
  | 'GUILD_TEMPLATE_BROWSER'
  | 'OVERLAY'
  | 'BROWSER_HANDOFF'
  | 'SET_CERTIFIED_DEVICES'
  | 'GET_IMAGE'
  | 'CREATE_LOBBY'
  | 'UPDATE_LOBBY'
  | 'DELETE_LOBBY'
  | 'UPDATE_LOBBY_MEMBER'
  | 'CONNECT_TO_LOBBY'
  | 'DISCONNECT_FROM_LOBBY'
  | 'SEND_TO_LOBBY'
  | 'SEARCH_LOBBIES'
  | 'CONNECT_TO_LOBBY_VOICE'
  | 'DISCONNECT_FROM_LOBBY_VOICE'
  | 'SET_OVERLAY_LOCKED'
  | 'OPEN_OVERLAY_ACTIVITY_INVITE'
  | 'OPEN_OVERLAY_GUILD_INVITE'
  | 'OPEN_OVERLAY_VOICE_SETTINGS'
  | 'VALIDATE_APPLICATION'
  | 'GET_ENTITLEMENT_TICKET'
  | 'GET_APPLICATION_TICKET'
  | 'START_PURCHASE'
  | 'START_PREMIUM_PURCHASE'
  | 'GET_SKUS'
  | 'GET_ENTITLEMENTS'
  | 'GET_NETWORKING_CONFIG'
  | 'NETWORKING_SYSTEM_METRICS'
  | 'NETWORKING_PEER_METRICS'
  | 'NETWORKING_CREATE_TOKEN'
  | 'SET_USER_ACHIEVEMENT'
  | 'GET_USER_ACHIEVEMENTS'
  | 'USER_SETTINGS_GET_LOCALE'
  | 'GET_ACTIVITY_JOIN_TICKET'
  | 'SEND_GENERIC_EVENT'
  | 'SEND_ANALYTICS_EVENT'
  | 'OPEN_EXTERNAL_LINK'
  | 'CAPTURE_LOG'
  | 'ENCOURAGE_HW_ACCELERATION'
  | 'SET_ORIENTATION_LOCK_STATE'

export type RPC_EVT =
  | 'CURRENT_USER_UPDATE'
  | 'GUILD_STATUS'
  | 'GUILD_CREATE'
  | 'CHANNEL_CREATE'
  | 'RELATIONSHIP_UPDATE'
  | 'VOICE_CHANNEL_SELECT'
  | 'VOICE_STATE_CREATE'
  | 'VOICE_STATE_DELETE'
  | 'VOICE_STATE_UPDATE'
  | 'VOICE_SETTINGS_UPDATE'
  | 'VOICE_SETTINGS_UPDATE_2'
  | 'VOICE_CONNECTION_STATUS'
  | 'SPEAKING_START'
  | 'SPEAKING_STOP'
  | 'GAME_JOIN'
  | 'GAME_SPECTATE'
  | 'ACTIVITY_JOIN'
  | 'ACTIVITY_JOIN_REQUEST'
  | 'ACTIVITY_SPECTATE'
  | 'ACTIVITY_INVITE'
  | 'ACTIVITY_PIP_MODE_UPDATE'
  | 'NOTIFICATION_CREATE'
  | 'MESSAGE_CREATE'
  | 'MESSAGE_UPDATE'
  | 'MESSAGE_DELETE'
  | 'LOBBY_DELETE'
  | 'LOBBY_UPDATE'
  | 'LOBBY_MEMBER_CONNECT'
  | 'LOBBY_MEMBER_DISCONNECT'
  | 'LOBBY_MEMBER_UPDATE'
  | 'LOBBY_MESSAGE'
  | 'OVERLAY'
  | 'OVERLAY_UPDATE'
  | 'ENTITLEMENT_CREATE'
  | 'ENTITLEMENT_DELETE'
  | 'USER_ACHIEVEMENT_UPDATE'
  | 'VOICE_CHANNEL_EFFECT_SEND'
  | 'THERMAL_STATE_UPDATE'
  | 'READY'
  | 'ERROR'

export interface CommandOutgoing<A = any> {
  cmd: RPC_CMD
  nonce: string | null
  args: A
  evt?: RPC_EVT
}

export interface CommandIncoming<A = any, D = any> {
  cmd: RPC_CMD
  nonce: string | null
  args?: A
  data: D
  evt?: RPC_EVT
}

export type TransportEvents = {
  /**
   * @event
   */
  message: (message: CommandIncoming) => void
  /**
   * @event
   */
  ping: () => void
  /**
   * @event
   */
  open: () => void
  /**
   * @event
   */
  close: (reason?: string | { code: number; message: string }) => void
}

export type TransportOptions = {
  client: Client
}

export abstract class Transport extends (EventEmitter as new () => TypedEmitter<TransportEvents>) {
  readonly client: Client

  get isConnected(): boolean {
    return false
  }

  constructor(options: TransportOptions) {
    // eslint-disable-next-line constructor-super
    super()
    this.client = options.client
  }

  abstract connect(): Promise<void>
  abstract send(data?: any): void
  abstract ping(): void
  abstract close(): Promise<void>
}
