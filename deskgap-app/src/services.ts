import { BaseService } from '@xmcl/runtime/app'
import { AgentService } from '@xmcl/runtime/agent'
import { AuthlibInjectorService } from '@xmcl/runtime/authlibInjector'
import { BedrockService } from '@xmcl/runtime/bedrock'
import { CollectionService } from '@xmcl/runtime/collection'
import { ExternalCredentialService } from '@xmcl/runtime/credential/ExternalCredentialService'
import { ElyByService } from '@xmcl/runtime/elyby'
import { VersionInstallService, VersionMetadataService } from '@xmcl/runtime/install'
import {
  InstanceBlueprintsService,
  InstanceLogService,
  InstanceModsGroupService,
  InstanceModsService,
  InstanceOptionsService,
  InstanceResourcePackService,
  InstanceSavesService,
  InstanceScreenshotService,
  InstanceServerInfoService,
  InstanceService,
  InstanceShaderPacksService,
  InstanceThemeService,
} from '@xmcl/runtime/instance'
import { InstanceIOService, InstanceInstallService, InstanceManifestService } from '@xmcl/runtime/instanceIO'
import { JavaService } from '@xmcl/runtime/java'
import { LaunchService, VersionService } from '@xmcl/runtime/launch'
import { BlueprintMarketService } from '@xmcl/runtime/market'
import { ProjectMappingService } from '@xmcl/runtime/moddb'
import { ModMetadataService } from '@xmcl/runtime/moddb/ModMetadataService'
import { ModpackService } from '@xmcl/runtime/modpack'
import { PeerService } from '@xmcl/runtime/peer'
import { PresenceService } from '@xmcl/runtime/presence'
import { RemoteServerService } from '@xmcl/runtime/remoteServer'
import { ResourcePackPreviewService } from '@xmcl/runtime/resourcePack'
import { ServerStatusService } from '@xmcl/runtime/serverStatus'
import { ThemeService } from '@xmcl/runtime/theme'
import { MinecraftFriendsService, OfficialUserService, UserService } from '@xmcl/runtime/user'
import { XmclAccountService } from '@xmcl/runtime/xmclAccount'

export const definedServices = [
  ExternalCredentialService,
  AgentService,
  VersionMetadataService,
  BaseService,
  AuthlibInjectorService,
  CollectionService,
  XmclAccountService,
  BedrockService,
  VersionInstallService,
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
  InstanceBlueprintsService,
  BlueprintMarketService,
  PresenceService,
  JavaService,
  LaunchService,
  ModpackService,
  InstanceServerInfoService,
  RemoteServerService,
  ResourcePackPreviewService,
  InstanceManifestService,
  ServerStatusService,
  OfficialUserService,
  MinecraftFriendsService,
  UserService,
  VersionService,
  InstanceInstallService,
  ModMetadataService,
  PeerService,
  ThemeService,
  InstanceThemeService,
]