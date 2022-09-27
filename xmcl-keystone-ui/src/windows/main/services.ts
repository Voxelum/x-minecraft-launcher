import { del, set } from '@vue/composition-api'
import type { ResolvedVersion } from '@xmcl/core'
import { BaseServiceKey, BaseState, CurseForgeServiceKey, CurseforgeState, DiagnoseServiceKey, DiagnoseState, EMPTY_JAVA, EMPTY_VERSION, FeedTheBeastServiceKey, FeedTheBeastState, GameProfileAndTexture, ImportServiceKey, InstallServiceKey, InstallState, InstanceInstallServiceKey, InstanceIOServiceKey, InstanceJavaServiceKey, InstanceJavaState, InstanceLogServiceKey, InstanceModsServiceKey, InstanceModsState, InstanceOptionsServiceKey, InstanceOptionsState, InstanceResourcePacksServiceKey, InstanceSavesServiceKey, InstanceServerInfoServiceKey, InstanceServiceKey, InstanceShaderPacksServiceKey, InstanceState, InstanceVersionServiceKey, InstanceVersionState, JavaRecord, JavaServiceKey, JavaState, LaunchServiceKey, LaunchState, LittleSkinUserServiceKey, LocalVersionHeader, ModpackServiceKey, ModrinthServiceKey, ModrinthState, OfficialUserServiceKey, PeerServiceKey, PeerState, ResourcePackPreviewServiceKey, ResourceServiceKey, ResourceState, SaveState, ServerInfoState, ServerStatusServiceKey, UserProfile, UserServiceKey, UserState, VersionServiceKey, VersionState } from '@xmcl/runtime-api'
import { GameProfile } from '@xmcl/user'
import { ServiceFactory } from '/@/composables'

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

export class ReactiveInstallState extends InstallState {
  constructor() {
    super()
    markRaw(this.minecraft.versions)
    markRaw(this.fabric.loaders)
    markRaw(this.optifine.versions)
  }
}

export function useAllServices(factory: ServiceFactory) {
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

  factory.register(FeedTheBeastServiceKey, () => new FeedTheBeastState())
  factory.register(InstanceJavaServiceKey, () => new ReactiveInstanceJavaState())
  factory.register(InstanceVersionServiceKey, () => new ReactiveInstanceVersionState())
  factory.register(PeerServiceKey, () => new PeerState())
  factory.register(BaseServiceKey, () => new BaseState())
  factory.register(DiagnoseServiceKey, () => new DiagnoseState())
  factory.register(InstanceOptionsServiceKey, () => new InstanceOptionsState())
  factory.register(InstanceModsServiceKey, () => new InstanceModsState())
  factory.register(InstanceSavesServiceKey, () => new SaveState())
  factory.register(InstanceServerInfoServiceKey, () => new ServerInfoState())
  factory.register(InstanceServiceKey, () => new InstanceState())
  factory.register(JavaServiceKey, () => new JavaState())
  factory.register(VersionServiceKey, () => new VersionState())
  factory.register(LaunchServiceKey, () => new LaunchState())
  factory.register(ResourceServiceKey, () => new ResourceState())
  factory.register(CurseForgeServiceKey, () => new CurseforgeState())
  factory.register(ModrinthServiceKey, () => new ModrinthState())
  factory.register(UserServiceKey, () => new ReactiveUserState())
}
