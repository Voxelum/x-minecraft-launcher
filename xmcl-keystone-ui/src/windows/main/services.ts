import { kServiceFactory } from '@/composables'
import { injection } from '@/util/inject'
import type { ResolvedVersion } from '@xmcl/core'
import { BaseServiceKey, BaseState, CurseForgeServiceKey, DiagnoseServiceKey, DiagnoseState, EMPTY_VERSION, GameProfileAndTexture, ImportServiceKey, InstallServiceKey, InstanceInstallServiceKey, InstanceIOServiceKey, InstanceLogServiceKey, InstanceManifestServiceKey, InstanceModsServiceKey, InstanceModsState, InstanceOptionsServiceKey, InstanceResourcePacksServiceKey, InstanceSavesServiceKey, InstanceSchema, InstanceScreenshotServiceKey, InstanceServerInfoServiceKey, InstanceServiceKey, InstanceShaderPacksServiceKey, InstanceState, InstanceUpdateServiceKey, InstanceVersionServiceKey, InstanceVersionState, JavaServiceKey, JavaState, LaunchServiceKey, LaunchState, LittleSkinUserServiceKey, LocalVersionHeader, ModpackServiceKey, ModrinthServiceKey, NatDeviceInfo, NatServiceKey, NatState, OfficialUserServiceKey, OfflineUserServiceKey, PeerServiceKey, PeerState, Resource, ResourcePackPreviewServiceKey, ResourceServiceKey, ServerStatusServiceKey, UserProfile, UserServiceKey, UserState, VersionServiceKey, VersionState } from '@xmcl/runtime-api'
import { DeepPartial } from '@xmcl/runtime-api/src/util/object'
import { GameProfile } from '@xmcl/user'
import { del, set } from 'vue'

class ReactiveInstanceVersionState extends InstanceVersionState {
  versionHeader = EMPTY_VERSION
  instanceVersion(version: ResolvedVersion | undefined) {
    set(this, 'version', version)
  }

  instanceVersionHeader(version: LocalVersionHeader | undefined) {
    set(this, 'versionHeader', version)
  }
}

class ReactiveUserState extends UserState {
  gameProfileUpdate({ profile, userId }: { userId: string; profile: (GameProfileAndTexture | GameProfile) }) {
    const userProfile = this.users[userId]
    if (profile.id in userProfile.profiles) {
      const instance = { textures: { SKIN: { url: '' } }, ...profile }
      set(userProfile.profiles, profile.id, instance)
    } else {
      userProfile.profiles[profile.id] = {
        textures: { SKIN: { url: '' } },
        ...profile,
      }
    }
  }

  userProfileRemove(userId: string) {
    if (this.selectedUser.id === userId) {
      this.selectedUser.id = ''
    }

    del(this.users, userId)
  }

  userProfile(user: UserProfile) {
    set(this.users, user.id, user)
  }
}

class ReactiveInstanceModState extends InstanceModsState {
  instanceModUpdate(r: Resource[]) {
    for (const res of r) {
      const existed = this.mods.findIndex(m => m.hash === res.hash)
      if (existed !== -1) {
        set(this.mods, existed, res)
      } else {
        this.mods = [...this.mods, res]
      }
    }
  }

  instanceModUpdateExisted(r: Resource[]) {
    for (const res of r) {
      const existed = this.mods.findIndex(m => m.hash === res.hash)
      if (existed !== -1) {
        set(this.mods, existed, { ...res, path: this.mods[existed].path })
      }
    }
  }
}

class ReactiveNatState extends NatState {
  natAddressSet(address: any): void {
    console.log(address)
    set(this, 'natAddress', address)
  }

  natDeviceSet(device: NatDeviceInfo): void {
    console.log(device)
    set(this, 'natDevice', device)
  }
}

class ReactiveInstanceState extends InstanceState {
  instanceEdit(settings: DeepPartial<InstanceSchema> & { path: string }): void {
    super.instanceEdit(settings)
    const inst = this.instances.find(i => i.path === (settings.path || this.path))!
    if ('showLog' in settings) {
      set(inst, 'showLog', settings.showLog)
    }
    if ('hideLauncher' in settings) {
      set(inst, 'hideLauncher', settings.hideLauncher)
    }
    if ('fastLaunch' in settings) {
      set(inst, 'fastLaunch', settings.fastLaunch)
    }
    if ('maxMemory' in settings) {
      set(inst, 'maxMemory', settings.maxMemory)
    }
    if ('minMemory' in settings) {
      set(inst, 'minMemory', settings.minMemory)
    }
    if ('assignMemory' in settings) {
      set(inst, 'assignMemory', settings.assignMemory)
    }
    if ('vmOptions' in settings) {
      set(inst, 'vmOptions', settings.vmOptions)
    }
    if ('mcOptions' in settings) {
      set(inst, 'mcOptions', settings.mcOptions)
    }
  }
}

export function useAllServices() {
  const factory = injection(kServiceFactory)

  factory.register(ImportServiceKey, () => undefined)
  factory.register(InstanceIOServiceKey, () => undefined)
  factory.register(ServerStatusServiceKey, () => undefined)
  factory.register(InstanceLogServiceKey, () => undefined)
  factory.register(ModpackServiceKey, () => undefined)
  factory.register(InstanceResourcePacksServiceKey, () => undefined)
  factory.register(InstanceShaderPacksServiceKey, () => undefined)
  factory.register(InstallServiceKey, () => undefined)
  factory.register(ResourcePackPreviewServiceKey, () => undefined)
  factory.register(OfficialUserServiceKey, () => undefined)
  factory.register(LittleSkinUserServiceKey, () => undefined)
  factory.register(InstanceInstallServiceKey, () => undefined)
  factory.register(InstanceManifestServiceKey, () => undefined)
  factory.register(OfflineUserServiceKey, () => undefined)
  factory.register(ResourceServiceKey, () => undefined)
  factory.register(InstanceUpdateServiceKey, () => undefined)
  factory.register(ModrinthServiceKey, () => undefined)
  factory.register(CurseForgeServiceKey, () => undefined)
  factory.register(InstanceScreenshotServiceKey, () => undefined)
  factory.register(InstanceOptionsServiceKey, () => undefined)
  factory.register(InstanceModsServiceKey, () => undefined)
  factory.register(InstanceSavesServiceKey, () => undefined)
  factory.register(InstanceServerInfoServiceKey, () => undefined)

  factory.register(NatServiceKey, () => new ReactiveNatState())
  factory.register(InstanceVersionServiceKey, () => new ReactiveInstanceVersionState())
  factory.register(PeerServiceKey, () => new PeerState())
  factory.register(BaseServiceKey, () => new BaseState())
  factory.register(DiagnoseServiceKey, () => new DiagnoseState())
  factory.register(InstanceServiceKey, () => new ReactiveInstanceState())
  factory.register(InstanceServiceKey, () => new InstanceState())
  factory.register(JavaServiceKey, () => new JavaState())
  factory.register(VersionServiceKey, () => new VersionState())
  factory.register(LaunchServiceKey, () => new LaunchState())
  factory.register(UserServiceKey, () => new ReactiveUserState())
}
