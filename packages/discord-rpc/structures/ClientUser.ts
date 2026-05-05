import type { ActivityType, GatewayActivityButton } from 'discord-api-types/v10'
import type { CertifiedDevice } from './CertifiedDevice'
import { VoiceSettings } from './VoiceSettings'
import { Lobby, type LobbyType } from './Lobby'
import { Channel } from './Channel'
import { Guild } from './Guild'
import { User } from './User'

export type SetActivity = {
  state?: string
  details?: string
  startTimestamp?: number | Date
  endTimestamp?: number | Date
  largeImageKey?: string
  smallImageKey?: string
  largeImageText?: string
  smallImageText?: string
  partyId?: string
  partySize?: number
  partyMax?: number
  matchSecret?: string
  joinSecret?: string
  spectateSecret?: string
  instance?: boolean
  buttons?: Array<GatewayActivityButton>
  // Doesn't work, juse don't use it
  type?: ActivityType.Playing | ActivityType.Watching
}

export type SetActivityResponse = {
  state?: string
  buttons?: string[]
  name: string
  application_id: string
  type: ActivityType
  metadata: {
    button_urls?: string[]
  }
}

export class ClientUser extends User {
  // #region Helper function

  async fetchUser(userId: string): Promise<User> {
    return new User(this.client, (await this.client.request('GET_USER', { id: userId })).data)
  }

  /**
   * Used to get a guild the client is in.
   *
   * @param guildId - id of the guild to get
   * @param timeout - asynchronously get guild with time to wait before timing out
   * @returns partial guild
   */
  async fetchGuild(guildId: string, timeout?: number): Promise<Guild> {
    return new Guild(
      this.client,
      (await this.client.request('GET_GUILD', { guild_id: guildId, timeout })).data,
    )
  }

  /**
   * Used to get a list of guilds the client is in.
   * @returns the guilds the user is in
   */
  async fetchGuilds(): Promise<Guild[]> {
    return (await this.client.request('GET_GUILDS')).data.guilds.map(
      (guildData: any) => new Guild(this.client, guildData),
    )
  }

  /**
   * Used to get a channel the client is in.
   * @param channelId - id of the channel to get
   * @returns partial channel
   */
  async fetchChannel(channelId: string): Promise<Channel> {
    return new Channel(
      this.client,
      (await this.client.request('GET_CHANNEL', { channel_id: channelId })).data,
    )
  }

  /**
   * Used to get a guild's channels the client is in.
   * @param guildId - id of the guild to get channels for
   * @returns guild channels the user is in
   */
  async fetchChannels(guildId: string): Promise<Channel> {
    return (await this.client.request('GET_CHANNELS', { guild_id: guildId })).data.channels.map(
      (channelData: any) => new Channel(this.client, channelData),
    )
  }

  /**
   * Used to get the client's current voice channel. There are no arguments for this command. Returns the [Get Channel](https://discord.com/developers/docs/topics/rpc#getchannel) response, or `null` if none.
   * @returns the client's current voice channel, `null` if none
   */
  async getSelectedVoiceChannel(): Promise<Channel | null> {
    const response = await this.client.request('GET_SELECTED_VOICE_CHANNEL')
    return response.data ? new Channel(this.client, response.data) : null
  }

  /**
   * Used to join voice channels, group dms, or dms. Returns the [Get Channel](https://discord.com/developers/docs/topics/rpc#getchannel) response, `null` if none.
   * @param channelId - channel id to join
   * @param timeout - asynchronously join channel with time to wait before timing out
   * @param force - forces a user to join a voice channel
   * @returns the channel that the user joined, `null` if none
   */
  async selectVoiceChannel(channelId: string, timeout?: number, force?: boolean): Promise<Channel> {
    return new Channel(
      this.client,
      (
        await this.client.request('SELECT_VOICE_CHANNEL', {
          channel_id: channelId,
          timeout,
          force,
        })
      ).data,
    )
  }

  /**
   * Used to leave voice channels, group dms, or dms
   * @param timeout - asynchronously join channel with time to wait before timing out
   * @param force - forces a user to join a voice channel
   */
  async leaveVoiceChannel(timeout?: number, force?: boolean): Promise<void> {
    await this.client.request('SELECT_VOICE_CHANNEL', {
      channel_id: null,
      timeout,
      force,
    })
  }

  /**
   * Used to get current client's voice settings
   * @returns the voice setting
   */
  async getVoiceSettings(): Promise<VoiceSettings> {
    return new VoiceSettings(this.client, (await this.client.request('GET_VOICE_SETTINGS')).data)
  }

  /**
   * Used to change voice settings of users in voice channels
   * @param voiceSettings - the settings
   * @returns the settings that have been set
   */
  async setVoiceSettings(voiceSettings: Partial<VoiceSettings>): Promise<VoiceSettings> {
    return new VoiceSettings(
      this.client,
      (await this.client.request('SET_VOICE_SETTINGS', voiceSettings)).data,
    )
  }

  /**
   * Used by hardware manufacturers to send information about the current state of their certified devices that are connected to Discord.
   * @param devices - a list of devices for your manufacturer, in order of priority
   * @returns
   */
  async setCeritfiedDevices(devices: CertifiedDevice[]): Promise<void> {
    await this.client.request('SET_CERTIFIED_DEVICES', { devices })
  }

  /**
   * Used to accept an Ask to Join request.
   * @param userId - the id of the requesting user
   */
  async sendJoinInvite(userId: string): Promise<void> {
    await this.client.request('SEND_ACTIVITY_JOIN_INVITE', { user_id: userId })
  }

  /**
   * Used to reject an Ask to Join request.
   * @param userId - the id of the requesting user
   */
  async closeJoinRequest(userId: string): Promise<void> {
    await this.client.request('CLOSE_ACTIVITY_JOIN_REQUEST', { user_id: userId })
  }

  /**
   * Used to join text channels, group dms, or dms. Returns the [Get Channel](https://discord.com/developers/docs/topics/rpc#getchannel) response, or `null` if none.
   * @param channelId - channel id to join
   * @param timeout - asynchronously join channel with time to wait before timing out
   * @returns the text channel that user joined
   */
  async selectTextChannel(channelId: string, timeout?: number): Promise<Channel | null> {
    return new Channel(
      this.client,
      (await this.client.request('SELECT_TEXT_CHANNEL', { channel_id: channelId, timeout })).data,
    )
  }

  /**
   * Used to leave text channels, group dms, or dms.
   * @param timeout - asynchronously join channel with time to wait before timing out
   */
  async leaveTextChannel(timeout?: number): Promise<void> {
    await this.client.request('SELECT_TEXT_CHANNEL', { channel_id: null, timeout })
  }

  async getRelationships(): Promise<Array<User>> {
    return (await this.client.request('GET_RELATIONSHIPS')).data.relationships.map((data: any) => {
      return new User(this.client, { ...data.user, presence: data.presence })
    })
  }

  /**
   * Used to update a user's Rich Presence.
   *
   * @param activity - the rich presence to assign to the user
   * @param pid - the application's process id
   * @returns The activity that have been set
   */
  async setActivity(activity: SetActivity, pid?: number): Promise<SetActivityResponse> {
    const formattedAcitivity: any = {
      ...activity,
      assets: {},
      timestamps: {},
      party: {},
      secrets: {},
    }

    if (activity.startTimestamp instanceof Date) {
      formattedAcitivity.timestamps.start = Math.round(activity.startTimestamp.getTime())
    } else if (typeof activity.startTimestamp === 'number') {
      formattedAcitivity.timestamps.start = activity.startTimestamp
    }

    if (activity.endTimestamp instanceof Date) {
      formattedAcitivity.timestamps.end = Math.round(activity.endTimestamp.getTime())
    } else if (typeof activity.endTimestamp === 'number') {
      formattedAcitivity.timestamps.end = activity.endTimestamp
    }

    if (activity.largeImageKey) formattedAcitivity.assets.large_image = activity.largeImageKey
    if (activity.smallImageKey) formattedAcitivity.assets.small_image = activity.smallImageKey
    if (activity.largeImageText) formattedAcitivity.assets.large_text = activity.largeImageText
    if (activity.smallImageText) formattedAcitivity.assets.small_text = activity.smallImageText

    if (activity.partyId) formattedAcitivity.party.id = activity.partyId
    if (activity.partySize && activity.partyMax) {
      formattedAcitivity.party.size = [activity.partySize, activity.partyMax]
    }

    if (activity.joinSecret) formattedAcitivity.secrets.join = activity.joinSecret
    if (activity.spectateSecret) formattedAcitivity.secrets.spectate = activity.spectateSecret
    if (activity.matchSecret) formattedAcitivity.secrets.match = activity.matchSecret

    if (Object.keys(formattedAcitivity.assets).length === 0) delete formattedAcitivity.assets
    if (Object.keys(formattedAcitivity.timestamps).length === 0)
      delete formattedAcitivity.timestamps
    if (Object.keys(formattedAcitivity.party).length === 0) delete formattedAcitivity.party
    if (Object.keys(formattedAcitivity.secrets).length === 0) delete formattedAcitivity.secrets

    formattedAcitivity.instance = !!activity.instance

    // Clean-up
    delete formattedAcitivity.startTimestamp
    delete formattedAcitivity.endTimestamp
    delete formattedAcitivity.largeImageKey
    delete formattedAcitivity.smallImageKey
    delete formattedAcitivity.largeImageText
    delete formattedAcitivity.smallImageText
    delete formattedAcitivity.partyId
    delete formattedAcitivity.partySize
    delete formattedAcitivity.partyMax
    delete formattedAcitivity.joinSecret
    delete formattedAcitivity.spectateSecret
    delete formattedAcitivity.matchSecret

    return (
      await this.client.request('SET_ACTIVITY', {
        pid: (pid ?? process) ? (process.pid ?? 0) : 0,
        activity: formattedAcitivity,
      })
    ).data
  }

  /**
   * Used to clear a user's Rich Presence.
   *
   * @param pid - the application's process id
   */
  async clearActivity(pid?: number): Promise<void> {
    await this.client.request('SET_ACTIVITY', { pid: (pid ?? process) ? (process.pid ?? 0) : 0 })
  }

  // #region Undocumented
  // This region holds method that are not documented by Discord BUT does exist

  /**
   * Create a new lobby
   * @param type - lobby type
   * @param capacity - lobby size
   * @param locked - is lobby locked
   * @param metadata - additional data?
   * @returns lobby that user created
   */
  async createLobby(
    type: LobbyType,
    capacity?: number,
    locked?: boolean,
    metadata?: any,
  ): Promise<Lobby> {
    return new Lobby(
      this.client,
      (await this.client.request('CREATE_LOBBY', { type, capacity, locked, metadata })).data,
    )
  }

  /**
   * Used to join a new lobby.
   * @param lobbyId - the id of the lobby to join
   * @param secret - the secret of the lobby to join
   * @returns the lobby that the user joined
   */
  async connectToLobby(lobbyId: string, secret: string): Promise<Lobby> {
    return new Lobby(
      this.client,
      (await this.client.request('CONNECT_TO_LOBBY', { id: lobbyId, secret })).data,
    )
  }

  /**
   * Used to join a new lobby.
   * @param lobbyId - the id of the lobby to join
   * @param data - additional data to send to lobby
   * @returns the lobby that the user joined
   */
  async sendToLobby(lobbyId: string, data: string): Promise<Lobby> {
    return new Lobby(
      this.client,
      (await this.client.request('SEND_TO_LOBBY', { lobby_id: lobbyId, data })).data,
    )
  }

  /**
   * Used to get a user's avatar
   * @param userId - id of the user to get the avatar of
   * @param format - image format
   * @param size - image size
   * @return base64 encoded image data
   */
  async getImage(
    userId: string,
    format: 'png' | 'webp' | 'jpg' = 'png',
    size: 16 | 32 | 64 | 128 | 256 | 512 | 1024 = 1024,
  ): Promise<string> {
    return (await this.client.request('GET_IMAGE', { type: 'user', id: userId, format, size })).data
      .data_url
  }

  // #endregion

  // #endregion
}
