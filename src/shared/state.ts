import { BaseState } from './services/BaseService'
import { CurseforgeState } from './services/CurseForgeService'
import { DiagnoseState } from './services/DiagnoseService'
import { InstallState } from './services/InstallService'
import { GameSettingState } from './services/InstanceGameSettingService'
import { InstanceJavaState } from './services/InstanceJavaService'
import { InstanceModsState } from './services/InstanceModsService'
import { InstanceResourcePacksState } from './services/InstanceResourcePacksService'
import { SaveState } from './services/InstanceSavesService'
import { InstanceState } from './services/InstanceService'
import { InstanceVersionState } from './services/InstanceVersionService'
import { JavaState } from './services/JavaService'
import { LaunchState } from './services/LaunchService'
import { ResourceState } from './services/ResourceService'
import { UserState } from './services/UserService'
import { VersionState } from './services/VersionService'

export type AllServiceMutations =
  Mutations<BaseState>
  & Mutations<CurseforgeState>
  & Mutations<DiagnoseState>
  & Mutations<InstallState>
  & Mutations<InstanceState>
  & Mutations<InstanceJavaState>
  & Mutations<InstanceVersionState>
  & Mutations<InstanceModsState>
  & Mutations<InstanceResourcePacksState>
  & Mutations<GameSettingState>
  & Mutations<SaveState>
  & Mutations<JavaState>
  & Mutations<LaunchState>
  & Mutations<ResourceState>
  & Mutations<UserState>
  & Mutations<VersionState>

export type MutationKeys = keyof AllServiceMutations
export type MutationPayload<T extends MutationKeys> = AllServiceMutations[T]

type Mutations<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K] extends ((payload: infer P) => void) ? P : never
}
