import { BaseService } from '@xmcl/runtime/app'
import { AuthlibInjectorService } from '@xmcl/runtime/authlibInjector'
import { ElyByService } from '@xmcl/runtime/elyby'
import { InstallService, VersionMetadataService } from '@xmcl/runtime/install'
import {
  InstanceLogService,
  InstanceModsService,
  InstanceOptionsService,
  InstanceSavesService,
  InstanceResourcePackService,
  InstanceScreenshotService,
  InstanceServerInfoService,
  InstanceService,
  InstanceShaderPacksService,
  InstanceThemeService,
  InstanceModsGroupService,
} from '@xmcl/runtime/instance'
import {
  InstanceIOService,
  InstanceInstallService,
  InstanceManifestService,
} from '@xmcl/runtime/instanceIO'
import { JavaService } from '@xmcl/runtime/java'
import { LaunchService, VersionService } from '@xmcl/runtime/launch'
import { ProjectMappingService } from '@xmcl/runtime/moddb'
import { ModMetadataService } from '@xmcl/runtime/moddb/ModMetadataService'
import { ModpackService } from '@xmcl/runtime/modpack'
import { PeerService } from '@xmcl/runtime/peer'
import { PresenceService } from '@xmcl/runtime/presence'
import { ResourcePackPreviewService } from '@xmcl/runtime/resourcePack'
import { ServerStatusService } from '@xmcl/runtime/serverStatus'
import { ThemeService } from '@xmcl/runtime/theme'
import { OfficialUserService, UserService } from '@xmcl/runtime/user'

export const definedServices = [
  VersionMetadataService,
  BaseService,
  AuthlibInjectorService,
  InstallService,
  ProjectMappingService,
  InstanceIOService,
  InstanceLogService,
  ElyByService,
  InstanceModsService,
  InstanceModsGroupService,
  InstanceOptionsService,
  InstanceResourcePackService,
  InstanceSavesService,
  InstanceService,
  InstanceScreenshotService,
  InstanceShaderPacksService,
  PresenceService,
  JavaService,
  LaunchService,
  ModpackService,
  InstanceServerInfoService,
  ResourcePackPreviewService,
  InstanceManifestService,
  ServerStatusService,
  OfficialUserService,
  UserService,
  VersionService,
  InstanceInstallService,
  ModMetadataService,
  PeerService,
  ThemeService,
  InstanceThemeService,
]
