import { AuthlibInjectorService } from '@xmcl/runtime/authlibInjector'
import { BaseService } from '@xmcl/runtime/base'
import { ElyByService } from '@xmcl/runtime/elyby'
import { ImportService } from '@xmcl/runtime/import'
import { DiagnoseService, InstallService, VersionMetadataService } from '@xmcl/runtime/install'
import { InstanceLogService, InstanceOptionsService, InstanceScreenshotService, InstanceServerInfoService, InstanceService } from '@xmcl/runtime/instance'
import { InstanceIOService, InstanceInstallService, InstanceManifestService, InstanceUpdateService } from '@xmcl/runtime/instanceIO'
import { JavaService } from '@xmcl/runtime/java'
import { LaunchService } from '@xmcl/runtime/launch'
import { InstanceModsService } from '@xmcl/runtime/mod'
import { ProjectMappingService } from '@xmcl/runtime/moddb'
import { ModMetadataService } from '@xmcl/runtime/moddb/ModMetadataService'
import { ModpackService } from '@xmcl/runtime/modpack'
import { PeerService } from '@xmcl/runtime/peer'
import { PresenceService } from '@xmcl/runtime/presence'
import { InstanceResourcePackService, InstanceShaderPacksService, ResourcePackPreviewService } from '@xmcl/runtime/resourcePack'
import { InstanceSavesService } from '@xmcl/runtime/save'
import { ServerStatusService } from '@xmcl/runtime/serverStatus'
import { ThemeService } from '@xmcl/runtime/theme'
import { OfficialUserService, UserService, YggdrasilService } from '@xmcl/runtime/user'
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
  InstanceOptionsService,
  InstanceResourcePackService,
  InstanceSavesService,
  InstanceService,
  InstanceScreenshotService,
  InstanceShaderPacksService,
  InstanceUpdateService,
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
  YggdrasilService,
  InstanceInstallService,
  ModMetadataService,
  PeerService,
  ThemeService,
]
