import { ServiceKey } from './Service'

export interface LocalSkin {
  id: string
  name: string
  url: string
  slim: boolean
  dateAdded: number
}

export interface LocalSkinState {
  skins: LocalSkin[]
  equippedSkinIds: Record<string, string>
}

export interface AddLocalSkinOptions {
  name: string
  source: string
  slim: boolean
}

export interface UpdateLocalSkinOptions {
  name?: string
  slim?: boolean
}

export interface LocalSkinService {
  getState(): Promise<LocalSkinState>
  addSkin(options: AddLocalSkinOptions): Promise<LocalSkin>
  updateSkin(id: string, options: UpdateLocalSkinOptions): Promise<LocalSkin>
  removeSkin(id: string): Promise<void>
  setEquippedSkin(account: string, id: string): Promise<void>
}

export const LocalSkinServiceKey: ServiceKey<LocalSkinService> = 'LocalSkinService'