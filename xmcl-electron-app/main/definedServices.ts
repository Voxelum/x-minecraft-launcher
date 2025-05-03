import { AuthlibInjectorService } from '@xmcl/runtime/authlibInjector'
import { BaseService } from '@xmcl/runtime/app'
import { ElyByService } from '@xmcl/runtime/elyby'
import { ImportService } from '@xmcl/runtime/import'
import { DiagnoseService, InstallService, VersionMetadataService } from '@xmcl/runtime/install'
import { InstanceLogService, InstanceOptionsService, InstanceScreenshotService, InstanceServerInfoService, InstanceService } from '@xmcl/runtime/instance'
import { InstanceIOService, InstanceInstallService, InstanceManifestService } from '@xmcl/runtime/instanceIO'
import { JavaService } from '@xmcl/runtime/java'
import { LaunchService } from '@xmcl/runtime/launch'
import { InstanceModsService, InstanceModsGroupService } from '@xmcl/runtime/mod'
import { ProjectMappingService } from '@xmcl/runtime/moddb'
import { ModMetadataService } from '@xmcl/runtime/moddb/ModMetadataService'
import { ModpackService } from '@xmcl/runtime/modpack'
import { PeerService } from '@xmcl/runtime/peer'
import { PresenceService } from '@xmcl/runtime/presence'
import { InstanceResourcePackService, InstanceShaderPacksService, ResourcePackPreviewService } from '@xmcl/runtime/resourcePack'
import { InstanceSavesService } from '@xmcl/runtime/save'
import { ServerStatusService } from '@xmcl/runtime/serverStatus'
import { ThemeService } from '@xmcl/runtime/theme'
import { OfficialUserService, UserService } from '@xmcl/runtime/user'
import { VersionService } from '@xmcl/runtime/version'

export const definedServices = [
  VersionMetadataService,
  BaseService,
  AuthlibInjectorService,
  ImportService,
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
  DiagnoseService,
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
]
