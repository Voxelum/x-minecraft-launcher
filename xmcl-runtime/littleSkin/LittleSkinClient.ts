import { AddClosetOptions, ClosetResponse, GetClosetOptions, ListSkinResult, LittleSkinCharacter, RenameClosetOptions, SetCharacterNameOptions, SetCharacterTextureOptions } from '@xmcl/runtime-api'

export class LittleSkinClient {
  constructor(private fetch: typeof global.fetch = fetch) {
  }

  async getAllCharacters(token: string): Promise<LittleSkinCharacter[]> {
    const response = await this.fetch('https://littleskin.cn/api/api/closet', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const result: LittleSkinCharacter[] = await response.json() as any
    return result
  }

  async setCharacterName(options: SetCharacterNameOptions, token: string): Promise<void> {
    const response = await this.fetch(`https://littleskin.cn/api/api/players/${options.pid}/name?name=${options.name}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    await response.json() as any
  }

  async setCharacterTexture(options: SetCharacterTextureOptions, token: string): Promise<void> {
    const response = await this.fetch(`https://littleskin.cn/api/api/players/${options.pid}/textures?cape=${options.cape}&skin=${options.skin}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    await response.json()
  }

  async addCloset(options: AddClosetOptions, token: string) {
    const response = await this.fetch(`https://littleskin.cn/api/api/closet?name=${options.name}&tid=${options.tid}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    await response.json()
  }

  async renameCloset(options: RenameClosetOptions, token: string) {
    const response = await this.fetch(`https://littleskin.cn/api/api/closet/${options.tid}?name=${options.name}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    await response.json()
  }

  async deleteCloset(tid: number, token: string) {
    const response = await this.fetch(`https://littleskin.cn/api/api/closet/${tid}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    await response.json()
  }

  async getCloset(options: GetClosetOptions, token: string) {
    const response = await this.fetch(`https://littleskin.cn/api/api/closet?page=${options.page || ''}&category=${options.category || ''}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const body: ClosetResponse = await response.json() as any
    return body
  }

  async listSkins(): Promise<ListSkinResult> {
    // https://littleskin.cn/skinlib/list
    const response = await this.fetch('https://littleskin.cn/api/skinlib/list', {
      method: 'GET',
    })

    const body = await response.json() as ListSkinResult
    return body
  }
}
