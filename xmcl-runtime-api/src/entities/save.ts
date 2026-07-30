import type { GameType } from '@xmcl/game-data'

/**
 * The brief metadata of a save
 */
export interface SaveMetadata {
  /**
   * The level name
   */
  levelName: string
  /**
   * The game mode
   */
  mode: GameType
  cheat: boolean
  gameVersion: string
  difficulty: number
  lastPlayed: number
  time: number

  advancements: number
  /**
   * The world seed
   */
  seed: string
}

export interface InstanceSaveHeader {
  /**
   * The path of the save directory
   */
  path: string
  /**
   * The instance name
   */
  instanceName: string
  /**
   * The file name of the save
   */
  name: string
  /**
   * The icon url
   */
  icon: string
  /**
   * If this save is a soft link to another save
   */
  linkTo?: string

  curseforge?: {
    projectId: number
    fileId: number
  }
}

/**
 * The brief info for a save under an instance
 */
export interface InstanceSave extends SaveMetadata, InstanceSaveHeader {
}

export interface ResourceSaveMetadata extends SaveMetadata {
  /**
   * The relative path of the save root
   */
  root: string
}

export class Saves {
  saves = [] as InstanceSave[]

  instanceSaves(save: InstanceSave[]) {
    this.saves = save
  }

  instanceSaveUpdate(save: InstanceSave) {
    const existed = this.saves.find(s => s.path === save.path)
    if (existed) {
      Object.assign(existed, save)
    } else {
      this.saves.push(save)
    }
  }

  instanceSaveRemove(save: string) {
    this.saves = this.saves.filter((s) => s.path !== save)
  }
}

/**
 * A datapack installed under a save's `datapacks/` folder.
 */
export interface InstanceDatapack {
  /**
   * The full path of the datapack file (zip) or folder.
   */
  path: string
  /**
   * The owner save folder path.
   */
  savePath: string
  /**
   * The file/folder name (basename) of the datapack.
   */
  fileName: string
  /**
   * The display name of the datapack.
   */
  name: string
  /**
   * The icon data url (from pack.png). Empty string if not present.
   */
  icon: string
  /**
   * The datapack description text.
   */
  description: string
  /**
   * The pack format declared in pack.mcmeta.
   */
  packFormat: number
  /**
   * The last modified time.
   */
  mtime: number
}

export function getInstanceSaveDatapacksKey(savePath: string) {
  return `save-datapacks://${savePath}`
}

export class SaveDatapacks {
  datapacks = [] as InstanceDatapack[]

  saveDatapacks(datapacks: InstanceDatapack[]) {
    this.datapacks = datapacks
  }

  saveDatapackUpdate(datapack: InstanceDatapack) {
    const existed = this.datapacks.find(d => d.path === datapack.path)
    if (existed) {
      Object.assign(existed, datapack)
    } else {
      this.datapacks.push(datapack)
    }
  }

  saveDatapackRemove(path: string) {
    this.datapacks = this.datapacks.filter((d) => d.path !== path)
  }
}
