import { InteroperableDispatcher } from '~/network/dispatchers/dispatcher'
import { AddClosetOptions, ClosetResponse, GetClosetOptions, ListSkinResult, LittleSkinCharacter, RenameClosetOptions, SetCharacterNameOptions, SetCharacterTextureOptions } from '@xmcl/runtime-api'
import { Dispatcher, request } from 'undici'

export class LittleSkinClient {
  private dispatcher: Dispatcher

  constructor(dispatcher: Dispatcher) {
    this.dispatcher = new InteroperableDispatcher([
      (options) => { options.origin = 'https://littleskin.cn/api' },
    ], dispatcher)
  }

  async getAllCharacters(token: string): Promise<LittleSkinCharacter[]> {
    const response = await request('/api/closet', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    })
    const result: LittleSkinCharacter[] = await response.body.json() as any
    return result
  }

  async setCharacterName(options: SetCharacterNameOptions, token: string): Promise<void> {
    const response = await request(`/api/players/${options.pid}/name`, {
      method: 'PUT',
      query: {
        name: options.name,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    })

    await response.body.json() as any
  }

  async setCharacterTexture(options: SetCharacterTextureOptions, token: string): Promise<void> {
    const response = await request(`/api/players/${options.pid}/textures`, {
      method: 'PUT',
      query: {
        skin: options.skin,
        cape: options.cape,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    })
    await response.body.json()
  }

  async addCloset(options: AddClosetOptions, token: string) {
    const response = await request('/api/closet', {
      method: 'POST',
      query: {
        tid: options.tid,
        name: options.name,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    })
    await response.body.json()
  }

  async renameCloset(options: RenameClosetOptions, token: string) {
    const response = await request(`/api/closet/${options.tid}`, {
      method: 'PUT',
      query: {
        name: options.name,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    })
    await response.body.json()
  }

  async deleteCloset(tid: number, token: string) {
    const response = await request(`/api/closet/${tid}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    })
    await response.body.json()
  }

  async getCloset(options: GetClosetOptions, token: string) {
    const response = await request('/api/closet', {
      method: 'GET',
      query: {
        page: options.page,
        category: options.category,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    })
    const body: ClosetResponse = await response.body.json() as any
    return body
  }

  async listSkins(): Promise<ListSkinResult> {
    // https://littleskin.cn/skinlib/list
    const response = await request('/skinlib/list', {
      method: 'GET',
    })

    const body = await response.body.json() as ListSkinResult
    return body
  }
}
