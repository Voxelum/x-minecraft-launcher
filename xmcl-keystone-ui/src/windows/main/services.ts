import { del, set } from 'vue'
import type { ResolvedVersion } from '@xmcl/core'
import { BaseServiceKey, BaseState, CurseForgeServiceKey, CurseforgeState, DiagnoseServiceKey, DiagnoseState, ElyByServiceKey, EMPTY_JAVA, EMPTY_VERSION, FeedTheBeastServiceKey, FeedTheBeastState, GameProfileAndTexture, ImportServiceKey, InstallServiceKey, InstanceInstallServiceKey, InstanceIOServiceKey, InstanceJavaServiceKey, InstanceJavaState, InstanceLogServiceKey, InstanceManifestServiceKey, InstanceModsServiceKey, InstanceModsState, InstanceOptionsServiceKey, InstanceOptionsState, InstanceResourcePacksServiceKey, InstanceSavesServiceKey, InstanceServerInfoServiceKey, InstanceServiceKey, InstanceShaderPacksServiceKey, InstanceState, InstanceVersionServiceKey, InstanceVersionState, JavaRecord, JavaServiceKey, JavaState, LaunchServiceKey, LaunchState, LittleSkinUserServiceKey, LocalVersionHeader, ModpackServiceKey, ModrinthServiceKey, ModrinthState, OfficialUserServiceKey, OfflineUserServiceKey, PeerServiceKey, PeerState, Persisted, Resource, ResourceDomain, ResourcePackPreviewServiceKey, ResourceServiceKey, ResourceState, SaveState, ServerInfoState, ServerStatusServiceKey, UserProfile, UserServiceKey, UserState, VersionServiceKey, VersionState } from '@xmcl/runtime-api'
import { GameProfile } from '@xmcl/user'
import { ServiceFactory, kServiceFactory } from '/@/composables'
import { injection } from '/@/util/inject'

// fix vue 2 reactivity
// TODO: remove this in vue 3

class ReactiveInstanceJavaState extends InstanceJavaState {
  java = EMPTY_JAVA

  instanceJava(java: JavaRecord | undefined) {
    set(this, 'java', java)
  }
}

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

class ReactiveResourceState extends ResourceState {
  resource(res: Persisted<Resource>) {
    let domain: Array<Resource> | undefined
    switch (res.domain) {
      case ResourceDomain.Mods:
        domain = this.mods
        break
      case ResourceDomain.ResourcePacks:
        domain = this.resourcepacks
        break
      case ResourceDomain.Saves:
        domain = this.saves
        break
      case ResourceDomain.Modpacks:
        domain = this.modpacks
        break
      case ResourceDomain.ShaderPacks:
        domain = this.shaderpacks
        break
      case ResourceDomain.Unclassified:
        domain = this.unclassified
        break
    }
    if (domain) {
      const index = domain.findIndex((r) => r.hash === res.hash)
      if (index !== -1) {
        set(domain, index, Object.freeze(res))
      } else {
        domain.push(Object.freeze(res) as any)
      }
    } else {
      throw new Error(`Cannot accept resource for unknown domain [${res.domain}]`)
    }
  }
}

class ReactiveInstanceModState extends InstanceModsState {
  instanceModUpdate(r: Resource[]) {
    for (const res of r) {
      const existed = this.mods.findIndex(m => m.hash === res.hash)
      if (existed !== -1) {
        set(this.mods, existed, res)
      } else {
        this.mods.push(res)
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
  factory.register(ElyByServiceKey, () => undefined)
  factory.register(OfflineUserServiceKey, () => undefined)

  factory.register(FeedTheBeastServiceKey, () => new FeedTheBeastState())
  factory.register(InstanceJavaServiceKey, () => new ReactiveInstanceJavaState())
  factory.register(InstanceVersionServiceKey, () => new ReactiveInstanceVersionState())
  factory.register(PeerServiceKey, () => new PeerState())
  factory.register(BaseServiceKey, () => new BaseState())
  factory.register(DiagnoseServiceKey, () => new DiagnoseState())
  factory.register(InstanceOptionsServiceKey, () => new InstanceOptionsState())
  factory.register(InstanceModsServiceKey, () => new ReactiveInstanceModState())
  factory.register(InstanceSavesServiceKey, () => new SaveState())
  factory.register(InstanceServerInfoServiceKey, () => new ServerInfoState())
  factory.register(InstanceServiceKey, () => new InstanceState())
  factory.register(JavaServiceKey, () => new JavaState())
  factory.register(VersionServiceKey, () => new VersionState())
  factory.register(LaunchServiceKey, () => new LaunchState())
  factory.register(ResourceServiceKey, () => new ReactiveResourceState())
  factory.register(CurseForgeServiceKey, () => new CurseforgeState())
  factory.register(ModrinthServiceKey, () => new ModrinthState())
  factory.register(UserServiceKey, () => new ReactiveUserState())
}
