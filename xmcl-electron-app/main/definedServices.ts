import { AuthlibInjectorService } from '@xmcl/runtime/authlibInjector'
import { BaseService } from '@xmcl/runtime/base'
import { CurseForgeService } from '@xmcl/runtime/curseforge'
import { ElyByService } from '@xmcl/runtime/elyby'
import { ImportService } from '@xmcl/runtime/import'
import { DiagnoseService, InstallService, VersionMetadataService } from '@xmcl/runtime/install'
import { InstanceLogService, InstanceOptionsService, InstanceScreenshotService, InstanceService } from '@xmcl/runtime/instance'
import { InstanceIOService, InstanceInstallService, InstanceManifestService, InstanceUpdateService } from '@xmcl/runtime/instanceIO'
import { JavaService } from '@xmcl/runtime/java'
import { LaunchService } from '@xmcl/runtime/launch'
import { InstanceModsService } from '@xmcl/runtime/mod'
import { ModMetadataService } from '@xmcl/runtime/moddb/ModMetadataService'
import { ModpackService } from '@xmcl/runtime/modpack'
import { ModrinthService } from '@xmcl/runtime/modrinth'
import { PeerService } from '@xmcl/runtime/peer'
import { PresenceService } from '@xmcl/runtime/presence'
import { ResourceService } from '@xmcl/runtime/resource'
import { InstanceResourcePackService, ResourcePackPreviewService, InstanceShaderPacksService } from '@xmcl/runtime/resourcePack'
import { InstanceSavesService } from '@xmcl/runtime/save'
import { ServerStatusService } from '@xmcl/runtime/serverStatus'
import { ThemeService } from '@xmcl/runtime/theme'
import { OfficialUserService, UserService, YggdrasilService } from '@xmcl/runtime/user'
import { VersionService } from '@xmcl/runtime/version'

export const definedServices = [
  VersionMetadataService,
  BaseService,
  CurseForgeService,
  AuthlibInjectorService,
  ImportService,
  InstallService,
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
  ModrinthService,
  ResourcePackPreviewService,
  ResourceService,
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
