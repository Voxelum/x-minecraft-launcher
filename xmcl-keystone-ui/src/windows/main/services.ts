import { del, set } from '@vue/composition-api'
import { BaseServiceKey, BaseState, CurseForgeServiceKey, CurseforgeState, DiagnoseServiceKey, DiagnoseState, GameProfileAndTexture, ImportServiceKey, InstallServiceKey, InstallState, ModpackServiceKey, InstanceIOServiceKey, InstanceJavaServiceKey, InstanceLogServiceKey, InstanceModsServiceKey, InstanceModsState, InstanceOptionsServiceKey, InstanceOptionsState, InstanceResourcePacksServiceKey, InstanceSavesServiceKey, InstanceServerInfoServiceKey, InstanceServiceKey, InstanceShaderPacksServiceKey, InstanceState, InstanceVersionServiceKey, JavaServiceKey, JavaState, LaunchServiceKey, LaunchState, ModrinthServiceKey, ModrinthState, ResourceServiceKey, ResourceState, SaveState, ServerInfoState, ServerStatusServiceKey, UserProfile, UserServiceKey, UserState, VersionServiceKey, VersionState, PeerServiceKey, PeerState, InstanceVersionState, InstanceJavaState, FeedTheBeastServiceKey, FeedTheBeastState, ResourcePackPreviewServiceKey } from '@xmcl/runtime-api'
import { GameProfile, ProfileServiceAPI, YggdrasilAuthAPI } from '@xmcl/user'
import { ServiceFactory } from '/@/composables'

// fix vue 2 reactivity
// TODO: remove this in vue 3
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
      this.selectedUser.profile = ''
    }

    del(this.users, userId)
  }

  userProfileAdd(profile: Omit<UserProfile, 'profiles'> & { id: string; profiles: (GameProfileAndTexture | GameProfile)[] }) {
    const value = {
      ...profile,
      profiles: profile.profiles
        .map(p => ({ ...p, textures: { SKIN: { url: '' } } }))
        .reduce((o: { [key: string]: any }, v) => { o[v.id] = v; return o }, {}),
      selectedProfile: profile.selectedProfile,
    }
    set(this.users, profile.id, value)
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

  factory.register(FeedTheBeastServiceKey, () => new FeedTheBeastState())
  factory.register(InstanceJavaServiceKey, () => new InstanceJavaState())
  factory.register(InstanceVersionServiceKey, () => new InstanceVersionState())
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
