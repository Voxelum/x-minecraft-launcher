import type { APIEmbed, APIAttachment, MessageType } from 'discord-api-types/v10'
import type { Client } from '../Client'
import { Base } from './Base'
import { User } from './User'

export class Message extends Base {
  /**
   * id of the message
   */
  id: string
  /**
   * if the message's author is blocked
   */
  blocked: boolean
  /**
   * if the message is sent by a bot
   */
  bot: boolean
  /**
   * contents of the message
   */
  content: string
  content_parsed: any[]
  /**
   * author's server nickname
   */
  nick: string
  author_color: string
  /**
   * when this message was edited (or null if never)
   */
  edited_timestamp: string | null
  /**
   * when this message was sent
   */
  timestamp: string
  /**
   * whether this was a TTS message
   */
  tts: boolean
  /**
   * users specifically mentioned in the message
   */
  mentions: User[]
  /**
   * whether this message mentions everyone
   */
  mention_everyone: boolean
  /**
   * roles specifically mentioned in this message
   */
  mention_roles: string[]
  /**
   * any embedded content
   */
  embeds: APIEmbed[]
  /**
   * any attached files
   */
  attachments: APIAttachment[]
  /**
   * the author of this message
   */
  author: User
  /**
   * whether this message is pinned
   */
  pinned: boolean
  /**
   * [type of message](https://discord.com/developers/docs/resources/channel#message-object-message-types)
   */
  type: MessageType

  constructor(client: Client, props: Record<string, any>) {
    super(client)
    Object.assign(this, props)

    this.id = props.id
    this.blocked = props.blocked
    this.bot = props.bot
    this.content = props.content
    this.content_parsed = props.content_parsed
    this.nick = props.nick
    this.author_color = props.author_color
    this.edited_timestamp = props.edited_timestamp
    this.timestamp = props.timestamp
    this.tts = props.tts
    this.mentions = props.mentions.map((mentionData: any) => new User(client, mentionData))
    this.mention_everyone = props.mention_everyone
    this.mention_roles = props.mention_roles
    this.embeds = props.embeds
    this.attachments = props.attachments
    this.author = new User(client, props.author)
    this.pinned = props.pinned
    this.type = props.type
  }
}
