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
import { BaseModule } from './modules/base'
import { UserModule } from './modules/user'
import { VersionModule } from './modules/version'
import { InstanceResourceModule } from './modules/instanceResource'
import { InstanceHMCLModpackModule } from './modules/instanceHCMLModpack'

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
    instanceHCMLModpack: InstanceHMCLModpackModule
    resource: ResourceModule
    base: BaseModule
    user: UserModule
    version: VersionModule
  }

  interface BaseState {
  }
  interface BaseGetters {
  }
  interface BaseMutations {
  }
}
