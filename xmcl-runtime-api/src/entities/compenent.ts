import type { LibraryInfo } from '@xmcl/core'
import type { LiteloaderModMetadata } from '@xmcl/mod-parser'
import { ForgeModCommonMetadata } from './mod'

export interface Component {
  /**
   * The identity of this component.
   * - For library, it will be the maven name like "org:artifactName:version"
   * - For mod, it will be the ":modid:version"
   */
  id: string
  /**
   * The deploy method of this component.
   *
   * - `library` means it's written in <version>.json file libraries
   * - `mod` means its file is placed under mods folder
   */
  deploy: 'library' | 'mod' | 'forge-arg'
}

export interface LibraryComponent extends Component {
  deploy: 'library'
  library: LibraryInfo
}

export interface ForgeModComponent extends Component {
  deploy: 'mod' | 'forge-arg'
  forge: ForgeModCommonMetadata
}

export interface LiteloaderModComponent extends Component {
  deploy: 'mod'
  liteloader: LiteloaderModMetadata
}

export interface FabricModComponent extends Component {
  deploy: 'mod'
  liteloader: FabricModComponent
}

export interface OptifineComponent extends Component {
  deploy: 'mod' | 'library'
}
