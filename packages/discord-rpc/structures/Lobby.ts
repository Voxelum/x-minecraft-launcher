/* eslint-disable camelcase */
import type { GatewayVoiceState } from 'discord-api-types/v10'
import type { Client } from '../Client'
import { type User } from './User'
import { Base } from './Base'

export enum LobbyType {
  PRIVATE = 1,
  PUBLIC = 2,
}

export class Lobby extends Base {
  application_id: string
  capacity: number
  id: string
  locked: boolean
  members: { metadata: any; user: User }[]
  metadata: any
  owner_id: string
  region: string
  secret: string
  type: LobbyType
  voice_states: GatewayVoiceState

  constructor(client: Client, props: Record<string, any>) {
    super(client)
    Object.assign(this, props)

    this.application_id = props.application_id
    this.capacity = props.capacity
    this.id = props.id
    this.locked = props.locked
    this.members = props.members
    this.metadata = props.metadata
    this.owner_id = props.owner_id
    this.region = props.region
    this.secret = props.secret
    this.type = props.type
    this.voice_states = props.voice_states
  }

  async joinVoice(): Promise<void> {
    await this.client.request('CONNECT_TO_LOBBY_VOICE', { id: this.id })
  }

  async leaveVoice(): Promise<void> {
    await this.client.request('DISCONNECT_FROM_LOBBY_VOICE', { id: this.id })
  }

  async update(
    type?: LobbyType,
    owner_id?: string,
    capacity?: number,
    locked?: boolean,
    metadata?: any,
  ): Promise<void> {
    this.type = type ?? this.type
    this.owner_id = owner_id ?? this.owner_id
    this.capacity = capacity ?? this.capacity
    this.locked = locked ?? this.locked
    this.metadata = metadata ?? this.metadata

    await this.client.request('UPDATE_LOBBY', {
      id: this.id,
      type,
      owner_id,
      capacity,
      locked,
      metadata,
    })
  }

  async updateMember(userId: string, metadata?: any): Promise<void> {
    await this.client.request('UPDATE_LOBBY_MEMBER', {
      lobby_id: this.id,
      user_id: userId,
      metadata,
    })
  }

  async disconnect(): Promise<void> {
    await this.client.request('DISCONNECT_FROM_LOBBY', { id: this.id })
  }

  async delete(): Promise<void> {
    await this.client.request('DELETE_LOBBY', { id: this.id })
  }
}
