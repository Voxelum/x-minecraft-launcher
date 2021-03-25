import { ClientModule } from './modules/client'
import { CurseForgeModule } from './modules/curseforge'
import { DiagnoseModule } from './modules/diagnose'
import { InstanceGameSettingModule } from './modules/instanceGameSetting'
import { InstanceModule } from './modules/instance'
import { JavaModule } from './modules/java'
import { LauncherModule } from './modules/launch'
import { ResourceModule } from './modules/resource'
import { InstanceSaveModule } from './modules/instanceSave'
import { InstanceServerInfoModule } from './modules/instanceServerInfo'
import { SettingModule } from './modules/setting'
import { UserModule } from './modules/user'
import { VersionModule } from './modules/version'
import { InstanceResourceModule } from './modules/instanceResource'

declare module './root' {
  interface ModuleMap {
    client: ClientModule
    curseforge: CurseForgeModule
    diagnose: DiagnoseModule
    java: JavaModule
    launch: LauncherModule
    instance: InstanceModule
    instanceGameSetting: InstanceGameSettingModule
    instanceServerInfo: InstanceServerInfoModule
    instanceSave: InstanceSaveModule
    instanceResource: InstanceResourceModule
    resource: ResourceModule
    setting: SettingModule
    user: UserModule
    version: VersionModule
  }

    type Semaphore = 'instance' | 'install' | 'java' | 'diagnose' | 'refreshMinecraft' | 'refreshForge' | 'refreshLiteloader'
    interface BaseState {
      /**
         * launcher root data folder path
         */
      root: string
      online: boolean
      platform: NodeJS.Platform
      launcherVersion: string
      semaphore: {
        [id: string]: number
      }
    }
    interface BaseGetters {
    }
    interface BaseMutations {
      root: string
      online: boolean
      launcherVersion: string
      platform: NodeJS.Platform
      aquire: Semaphore | Semaphore[]
      release: Semaphore | Semaphore[]
    }
}
