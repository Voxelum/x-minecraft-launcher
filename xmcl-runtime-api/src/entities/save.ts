import type { GameType } from '@xmcl/game-data'

/**
 * The brief info for a save under an instance
 */
export interface InstanceSave {
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
}

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
}

export interface InstanceSaveMetadata extends InstanceSave, SaveMetadata {
  advancements: number
}

export interface ResourceSaveMetadata extends SaveMetadata {
  /**
     * The relative path of the save root
     */
  root: string
}

export class Saves {
  saves = [] as InstanceSaveMetadata[]

  instanceSaveUpdate(save: InstanceSaveMetadata) {
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
