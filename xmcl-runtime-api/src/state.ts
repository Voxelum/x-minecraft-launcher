import { ResourceState } from './entities/resource'
import { Saves } from './entities/save'
import { Settings } from './entities/setting'
import { LocalVersions } from './entities/version'
import { InstanceInstallStatus } from './services/InstanceInstallService'
import { InstanceModsGroupState } from './services/InstanceModsGroupService'
import { GameOptionsState } from './services/InstanceOptionsService'
import { InstanceState } from './services/InstanceService'
import { JavaState } from './services/JavaService'
import { ModpackState } from './services/ModpackService'
import { PeerState } from './services/PeerService'
import { UserState } from './services/UserService'

export type Mutations<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K] extends ((payload: infer P) => void) ? P : never
}

export const AllStates = [
  Settings,
  InstanceState,
  ResourceState,
  ModpackState,
  GameOptionsState,
  Saves,
  JavaState,
  UserState,
  LocalVersions,
  PeerState,
  InstanceInstallStatus,
  InstanceModsGroupState,
]
