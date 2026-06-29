import { useExternalRoute, useI18nSync } from '@/composables'
import { kCriticalStatus, useCriticalStatus } from '@/composables/criticalStatus'
import { kCurseforgeCategories, useCurseforgeCategories } from '@/composables/curseforge'
import { kCustomCss, useCustomCss } from '@/composables/customCss'
import { kDropHandler, useDropHandler } from '@/composables/dropHandler'
import { kEnvironment, useEnvironment } from '@/composables/environment'
import { kImageDialog, useImageDialog } from '@/composables/imageDialog'
import { kInstance, useInstance } from '@/composables/instance'
import { kInstanceBlueprints, useInstanceBlueprints } from '@/composables/instanceBlueprints'
import { kInstanceDefaultSource, useInstanceDefaultSource } from '@/composables/instanceDefaultSource'
import { kInstanceFiles, useInstanceFiles } from '@/composables/instanceFiles'
import { kInstanceJava, useInstanceJava } from '@/composables/instanceJava'
import { kInstanceJavaDiagnose, useInstanceJavaDiagnose } from '@/composables/instanceJavaDiagnose'
import { kInstanceLaunch, useInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceModsContext, useInstanceMods } from '@/composables/instanceMods'
import { kInstanceOptions, useInstanceOptions } from '@/composables/instanceOptions'
import { kInstanceResourcePacks, useInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { kInstanceSave, useInstanceSaves } from '@/composables/instanceSave'
import { kInstanceServerInfo, useInstanceServerInfo } from '@/composables/instanceServerInfo'
import { kInstanceShaderPacks, useInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { kInstanceTheme, useInstanceTheme } from '@/composables/instanceTheme'
import { kInstanceVersion, useInstanceVersion } from '@/composables/instanceVersion'
import { kInstanceVersionInstall, useInstanceVersionInstallInstruction } from '@/composables/instanceVersionInstall'
import { kInstances, useInstances } from '@/composables/instances'
import { kJavaContext, useJavaContext } from '@/composables/java'
import { kLaunchTask, useLaunchTask } from '@/composables/launchTask'
import { kModDependenciesCheck, useModDependenciesCheck } from '@/composables/modDependenciesCheck'
import { kModLibCleaner, useModLibCleaner } from '@/composables/modLibCleaner'
import { kModsSearch, useModsSearch } from '@/composables/modSearch'
import { kModUpgrade, useModUpgrade } from '@/composables/modUpgrade'
import { kModpackExport, useModpackExport } from '@/composables/modpack'
import { kInstanceServerLaunch, useInstanceServerLaunch } from '@/composables/instanceServerLaunch'
import { kModrinthTags, useModrinthTags } from '@/composables/modrinth'
import { kModrinthAuthenticatedAPI, useModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI'
import { kPeerShared, usePeerConnections } from '@/composables/peers'
import { kResourcePackSearch, useResourcePackSearch } from '@/composables/resourcePackSearch'
import { kSaveSearch, useSavesSearch } from '@/composables/savesSearch'
import { kSearchModel, useSearchModel } from '@/composables/search'
import { kServerStatusCache, useServerStatusCache } from '@/composables/serverStatus'
import { kSettingsState, useSettingsState } from '@/composables/setting'
import {
  DEFAULT_CARD_CLICKABLE_RADIUS,
  DEFAULT_CARD_ITEM_RADIUS,
  DEFAULT_CARD_PROMINENT_RADIUS,
  DEFAULT_CARD_RADIUS,
  DEFAULT_CARD_SUBSECTION_RADIUS,
  DEFAULT_PANEL_RADIUS,
  DEFAULT_SURFACE_MENU_ITEM_RADIUS,
  DEFAULT_SURFACE_PILL_RADIUS,
  DEFAULT_SURFACE_RADIUS,
  DEFAULT_SURFACE_BUTTON_RADIUS,
  DEFAULT_SURFACE_DIALOG_RADIUS,
  DEFAULT_SURFACE_TOOLTIP_RADIUS,
  kSurfaceTokens,
  useSurfaceTokens,
} from '@/composables/surfaceTokens'
import { kShaderPackSearch, useShaderPackSearch } from '@/composables/shaderPackSearch'
import { useTelemetryTrack } from '@/composables/telemetryTrack'
import { kTheme, useTheme } from '@/composables/theme'
import { kTutorial, useTutorialModel } from '@/composables/tutorial'

import { kNetworkStatus, useNetworkStatus } from '@/composables/useNetworkStatus'
import { kUserContext, useUserContext } from '@/composables/user'
import { kLatestMinecraftVersion, useMinecraftLatestRelease } from '@/composables/version'
import { kLocalVersions, useLocalVersions } from '@/composables/versionLocal'
import { kSupportedAuthorityMetadata, useSupportedAuthority } from '@/composables/yggrasil'
import { vuetify } from '@/vuetify'
import { provide, watchEffect } from 'vue'

export default defineComponent({
  setup(props, ctx) {
    provide(kServerStatusCache, useServerStatusCache())

    provide(kDropHandler, useDropHandler())

    const user = useUserContext()
    provide(kUserContext, user)
    const java = useJavaContext()
    const localVersions = useLocalVersions()
    const instances = useInstances()
    const instance = useInstance(instances.selectedInstance, instances.instances)
    provide(kPeerShared, usePeerConnections())

    const settings = useSettingsState()
    const instanceVersion = useInstanceVersion(instance.instance, localVersions.versions, localVersions.servers)
    const instanceJava = useInstanceJava(instance.instance, instanceVersion.resolvedVersion, java.all)
    provide(kInstanceJavaDiagnose, useInstanceJavaDiagnose(instanceJava))
    const instanceDefaultSource = useInstanceDefaultSource(instance.path)
    const options = useInstanceOptions(instance.path)
    const saves = useInstanceSaves(instance.path)
    const serverInfo = useInstanceServerInfo(instance.path)
    const resourcePacks = useInstanceResourcePacks(instance.path, options.gameOptions)
    const instanceMods = useInstanceMods(instance.path, instance.runtime, instanceJava.java)
    const blueprints = useInstanceBlueprints(instance.path)
    const shaderPacks = useInstanceShaderPacks(instance.path, instance.runtime, instanceMods.mods, options.gameOptions)
    const files = useInstanceFiles(instance.path)
    const task = useLaunchTask(instance.path, instance.runtime, instanceVersion.versionId)
    const instanceLaunch = useInstanceLaunch(instance.instance, instanceVersion.versionId, instanceVersion.serverVersionId, instanceJava.java, user.userProfile, settings, instanceMods.mods)

    const modrinthAPI = useModrinthAuthenticatedAPI()
    provide(kModrinthAuthenticatedAPI, modrinthAPI)
    const searchModel = useSearchModel(instance.runtime)
    provide(kSearchModel, searchModel)
    const modsSearch = useModsSearch(instance.path, instance.runtime, instanceMods.mods, instanceMods.isValidating, settings.state, modrinthAPI, searchModel)
    const modUpgrade = useModUpgrade(instance.path, instance.runtime, instanceMods.mods, instanceMods.updateMetadata)

    const resourcePackSearch = useResourcePackSearch(resourcePacks.enabled, resourcePacks.disabled, modrinthAPI, searchModel)
    const shaderPackSearch = useShaderPackSearch(shaderPacks.shaderPacks, modrinthAPI, searchModel)

    const install = useInstanceVersionInstallInstruction(instance.path, instance.instances, instanceVersion.resolvedVersion, instanceVersion.refreshResolvedVersion, localVersions.versions, localVersions.servers, java.all, java.refresh)

    useTelemetryTrack(settings.state)

    provide(kCriticalStatus, useCriticalStatus(settings.state))

    provide(kLatestMinecraftVersion, useMinecraftLatestRelease())
    provide(kJavaContext, java)
    provide(kSettingsState, settings)
    provide(kInstances, instances)
    provide(kInstance, instance)
    provide(kLocalVersions, localVersions)
    provide(kInstanceLaunch, instanceLaunch)

    provide(kInstanceVersion, instanceVersion)
    provide(kInstanceDefaultSource, instanceDefaultSource)
    provide(kInstanceJava, instanceJava)
    provide(kInstanceOptions, options)
    provide(kInstanceSave, saves)
    provide(kInstanceServerInfo, serverInfo)
    provide(kInstanceResourcePacks, resourcePacks)
    provide(kInstanceModsContext, instanceMods)
    provide(kInstanceBlueprints, blueprints)
    provide(kInstanceFiles, files)
    provide(kLaunchTask, task)

    provide(kInstanceVersionInstall, install)

    provide(kInstanceShaderPacks, shaderPacks)
    provide(kResourcePackSearch, resourcePackSearch)
    provide(kShaderPackSearch, shaderPackSearch)
    provide(kModsSearch, modsSearch)
    provide(kModDependenciesCheck, useModDependenciesCheck(instance.path, instance.runtime, instanceMods.mods, instanceMods.updateMetadata))
    provide(kModLibCleaner, useModLibCleaner(instanceMods.mods, instanceMods.allowLoaders))
    provide(kSaveSearch, useSavesSearch(saves.saves, saves.sharedSaves, searchModel))
    provide(kModUpgrade, modUpgrade)
    provide(kEnvironment, useEnvironment())

    const instanceTheme = useInstanceTheme(instance.path)
    provide(kInstanceTheme, instanceTheme)
    const theme = useTheme(instanceTheme.instanceTheme)
    provide(kTheme, theme)
    const surfaceTokens = useSurfaceTokens()
    provide(kSurfaceTokens, surfaceTokens)

    watchEffect(() => {
      const enabled = theme.currentTheme.value.borderRadiusEnabled ?? true
      surfaceTokens.radius.value = enabled ? DEFAULT_SURFACE_RADIUS : 0
      surfaceTokens.dialogRadius.value = enabled ? DEFAULT_SURFACE_DIALOG_RADIUS : 0
      surfaceTokens.menuItemRadius.value = enabled ? DEFAULT_SURFACE_MENU_ITEM_RADIUS : 0
      surfaceTokens.cardRadius.value = enabled ? DEFAULT_CARD_RADIUS : 0
      surfaceTokens.cardSubsectionRadius.value = enabled ? DEFAULT_CARD_SUBSECTION_RADIUS : 0
      surfaceTokens.cardItemRadius.value = enabled ? DEFAULT_CARD_ITEM_RADIUS : 0
      surfaceTokens.panelRadius.value = enabled ? DEFAULT_PANEL_RADIUS : 0
      surfaceTokens.cardProminentRadius.value = enabled ? DEFAULT_CARD_PROMINENT_RADIUS : 0
      surfaceTokens.cardClickableRadius.value = enabled ? DEFAULT_CARD_CLICKABLE_RADIUS : 0
      surfaceTokens.tooltipRadius.value = enabled ? DEFAULT_SURFACE_TOOLTIP_RADIUS : 0
      surfaceTokens.pillRadius.value = enabled ? DEFAULT_SURFACE_PILL_RADIUS : 0
      vuetify.defaults.value = {
        ...vuetify.defaults.value,
        VBtn: {
          ...vuetify.defaults.value?.VBtn,
          rounded: enabled ? DEFAULT_SURFACE_BUTTON_RADIUS : 0,
        },
        VChip: {
          ...vuetify.defaults.value?.VChip,
          rounded: enabled ? DEFAULT_SURFACE_BUTTON_RADIUS : 0,
        },
        VTextField: {
          ...vuetify.defaults.value?.VTextField,
          rounded: enabled ? undefined : 0,
        },
        VSwitch: {
          ...vuetify.defaults.value?.VSwitch,
          rounded: enabled ? undefined : 0,
        }
      }
    })

    provide(kCustomCss, useCustomCss({
      currentTheme: theme.currentTheme,
      instanceTheme: instanceTheme.instanceTheme,
      instanceCss: instanceTheme.customCss,
      suppressed: theme.suppressed,
    }))


    useI18nSync(settings.state)

    const router = useRouter()
    useExternalRoute(router)

    provide(kImageDialog, useImageDialog())
    provide(kSupportedAuthorityMetadata, useSupportedAuthority())
    provide(kTutorial, useTutorialModel())
    provide(kModrinthTags, useModrinthTags())
    provide(kCurseforgeCategories, useCurseforgeCategories())
    provide(kModpackExport, useModpackExport())
    provide(kInstanceServerLaunch, useInstanceServerLaunch())
    provide(kNetworkStatus, useNetworkStatus())

    return () => ctx.slots.default?.()
  },
})
