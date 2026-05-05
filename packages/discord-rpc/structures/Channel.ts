import type { ChannelType, GatewayVoiceState } from 'discord-api-types/v10'
import type { Client } from '../Client'
import { Message } from './Message'
import { Base } from './Base'

export class Channel extends Base {
  /**
   * channel id
   */
  id: string
  /**
   * channel's guild id
   */
  guild_id?: string
  /**
   * channel name
   */
  name: string
  /**
   * channel type (guild text: 0, guild voice: 2, dm: 1, group dm: 3)
   */
  type: ChannelType
  /**
   * (text) channel topic
   */
  topic?: string
  /**
   * (voice) bitrate of voice channel
   */
  bitrate?: number
  /**
   * (voice) user limit of voice channel (0 for none)
   */
  user_limit?: number
  /**
   * position of channel in channel list
   */
  position?: number
  /**
   * (voice) channel's voice states
   */
  voice_states?: GatewayVoiceState[]
  /**
   * (text) channel's messages
   */
  messages?: Message[]

  constructor(client: Client, props: Record<string, any>) {
    super(client)
    Object.assign(this, props)

    this.id = props.id
    this.guild_id = props.guild_id
    this.name = props.name
    this.type = props.type
    this.topic = props.topic
    this.bitrate = props.bitrate
    this.user_limit = props.user_limit
    this.position = props.position
    this.voice_states = props.voice_states
    this.messages = props.messages?.map((messgeData: any) => new Message(client, messgeData))
  }
}
