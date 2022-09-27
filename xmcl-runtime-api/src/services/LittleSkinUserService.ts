/* eslint-disable camelcase */
import { GameProfileAndTexture } from '../entities/user.schema'
import { GenericEventEmitter } from '../events'
import { ServiceKey } from './Service'

export interface GetClosetOptions {
  category?: 'skin' | 'cape'
  page?: number
}

export interface RenameClosetOptions {
  tid: number
  name: string
}

export interface AddClosetOptions {
  tid: number
  name: string
}

export interface ClosetResponse {
  per_page: number
  from: number
  to: number
  total: number
  current_page: number
  last_page: number
  data: Closet[]
}

export interface Closet {
  tid: number
  name: string
  type: string
  hash: string
  size: number
  uploader: number
  public: boolean
  upload_at: string
  likes: number
  pivot: ClosetPivot
}

export interface ClosetPivot {
  item_name: string
}

export interface LittleSkinCharacter {
  pid: number
  uid: number
  name: string
  tid_skin: number
  tid_cape: number
  last_modified: string
}

export interface SetCharacterNameOptions {
  pid: number
  name: string
}

export interface SetCharacterTextureOptions {
  pid: number
  skin?: number
  cape?: number
}

export interface ListSkinOptions {
  filter?: 'skin' | 'cape' | 'steve' | 'alex'
  keyword?: string
  sort?: 'time' |'likes'
  /**
   * start with 1
   */
  page?: number
}
export interface ListSkinResult {
  current_page: number
  data: SkinData[]
  first_page_url: string
  from: number
  last_page: number
  last_page_url: string
  links: SkinLink[]
  next_page_url: string
  path: string
  per_page: number
  prev_page_url: any
  to: number
  total: number
}

export interface SkinData {
  tid: number
  name: string
  type: string
  uploader: number
  public: boolean
  likes: number
  nickname: string
}

export interface SkinLink {
  url?: string
  label: string
  active: boolean
}

export interface UploadTextureOptions {

}
export interface UploadTextureResult { }

export interface LittleSkinUserService {
  authenticate(): Promise<void>

  getAllCharacters(): Promise<LittleSkinCharacter[]>

  setCharacterName(options: SetCharacterTextureOptions): Promise<void>

  setCharacterTexture(options: SetCharacterTextureOptions): Promise<void>

  listSkins(options: ListSkinOptions): Promise<ListSkinResult>

  uploadTexture(options: UploadTextureOptions): Promise<UploadTextureResult>
}

export const LittleSkinUserServiceKey: ServiceKey<LittleSkinUserService> = 'LittleSkinUserService'
