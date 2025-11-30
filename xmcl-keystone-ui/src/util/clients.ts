import { CurseforgeV1Client } from '@xmcl/curseforge'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { FTBClient } from './ftbClient'

// Extended ModrinthV2Client with additional methods
class ExtendedModrinthV2Client extends ModrinthV2Client {
  async deleteCollection(collectionId: string, signal?: AbortSignal) {
    const response = await fetch(`https://api.modrinth.com/v3/collection/${collectionId}`, {
      method: 'DELETE',
      headers: this.headers,
      signal,
    })
    if (!response.ok) {
      throw new Error(`Failed to delete collection: ${response.status} ${await response.text()}`)
    }
  }
}

export const clientModrinthV2 = new ExtendedModrinthV2Client()
export const clientCurseforgeV1 = new CurseforgeV1Client('', {})
export const clientFTB = new FTBClient()
