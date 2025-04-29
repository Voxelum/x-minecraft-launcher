import { kFilterCombobox, useExternalRoute, useFilterComboboxData, useI18nSync } from '@/composables'
import { kCurseforgeCategories, useCurseforgeCategories } from '@/composables/curseforge'
import { kCriticalStatus, useCriticalStatus } from '@/composables/criticalStatus'
import { kDropHandler, useDropHandler } from '@/composables/dropHandler'
import { kEnvironment, useEnvironment } from '@/composables/environment'
import { kImageDialog, useImageDialog } from '@/composables/imageDialog'
import { kInstance, useInstance } from '@/composables/instance'
import { kInstanceDefaultSource, useInstanceDefaultSource } from '@/composables/instanceDefaultSource'
import { kInstanceFiles, useInstanceFiles } from '@/composables/instanceFiles'
import { kInstanceJava, useInstanceJava } from '@/composables/instanceJava'
import { kInstanceJavaDiagnose, useInstanceJavaDiagnose } from '@/composables/instanceJavaDiagnose'
import { kInstanceLaunch, useInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceModsContext, useInstanceMods } from '@/composables/instanceMods'
import { kInstanceOptions, useInstanceOptions } from '@/composables/instanceOptions'
import { kInstanceResourcePacks, useInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { kInstanceSave, useInstanceSaves } from '@/composables/instanceSave'
import { kInstanceShaderPacks, useInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { kInstanceVersion, useInstanceVersion } from '@/composables/instanceVersion'
import { kInstanceVersionInstall, useInstanceVersionInstallInstruction } from '@/composables/instanceVersionInstall'
import { kInstances, useInstances } from '@/composables/instances'
import { kJavaContext, useJavaContext } from '@/composables/java'
import { kLaunchTask, useLaunchTask } from '@/composables/launchTask'
import { kModDependenciesCheck, useModDependenciesCheck } from '@/composables/modDependenciesCheck'
import { kModLibCleaner, useModLibCleaner } from '@/composables/modLibCleaner'
import { kModsSearch, useModsSearch } from '@/composables/modSearch'
import { kModUpgrade, useModUpgrade } from '@/composables/modUpgrade'
import { kModrinthTags, useModrinthTags } from '@/composables/modrinth'
import { kModrinthAuthenticatedAPI, useModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI'
import { kPeerShared, usePeerConnections } from '@/composables/peers'
import { kResourcePackSearch, useResourcePackSearch } from '@/composables/resourcePackSearch'
import { kSaveSearch, useSavesSearch } from '@/composables/savesSearch'
import { kSearchModel, useSearchModel } from '@/composables/search'
import { kServerStatusCache, useServerStatusCache } from '@/composables/serverStatus'
import { kSettingsState, useSettingsState } from '@/composables/setting'
import { kShaderPackSearch, useShaderPackSearch } from '@/composables/shaderPackSearch'
import { useTelemetryTrack } from '@/composables/telemetryTrack'
import { kTheme, useTheme } from '@/composables/theme'
import { kTutorial, useTutorialModel } from '@/composables/tutorial'
import { kUILayout, useUILayout } from '@/composables/uiLayout'
import { kUserContext, useUserContext } from '@/composables/user'
import { kLocalVersions, useLocalVersions } from '@/composables/versionLocal'
import { kSupportedAuthorityMetadata, useSupportedAuthority } from '@/composables/yggrasil'
import { vuetify } from '@/vuetify'
import 'virtual:uno.css'
import { provide } from 'vue'

export default defineComponent({
  setup(props, ctx) {
    provide(kServerStatusCache, useServerStatusCache())

    provide(kDropHandler, useDropHandler())

    const user = useUserContext()
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
    const resourcePacks = useInstanceResourcePacks(instance.path, options.gameOptions)
    const instanceMods = useInstanceMods(instance.path, instance.runtime, instanceJava.java)
    const shaderPacks = useInstanceShaderPacks(instance.path, instance.runtime, instanceMods.mods, options.gameOptions)
    const files = useInstanceFiles(instance.path)
    const task = useLaunchTask(instance.path, instance.runtime, instanceVersion.versionId)
    const instanceLaunch = useInstanceLaunch(instance.instance, instanceVersion.versionId, instanceVersion.serverVersionId, instanceJava.java, user.userProfile, settings, instanceMods.mods)

    const modrinthAPI = useModrinthAuthenticatedAPI()
    provide(kModrinthAuthenticatedAPI, modrinthAPI)
    const searchModel = useSearchModel(instance.runtime)
    provide(kSearchModel, searchModel)
    const modsSearch = useModsSearch(instance.path, instance.runtime, instanceMods.mods, instanceMods.isValidating, settings.state, modrinthAPI, searchModel)
    const modUpgrade = useModUpgrade(instance.path, instance.runtime, instanceMods.mods)

    const resourcePackSearch = useResourcePackSearch(resourcePacks.enabled, resourcePacks.disabled, modrinthAPI, searchModel)
    const shaderPackSearch = useShaderPackSearch(shaderPacks.shaderPacks, modrinthAPI, searchModel)

    const install = useInstanceVersionInstallInstruction(instance.path, instance.instances, instanceVersion.resolvedVersion, instanceVersion.refreshResolvedVersion, localVersions.versions, localVersions.servers, java.all, java.refresh)

    useTelemetryTrack(settings.state)

    provide(kCriticalStatus, useCriticalStatus(settings.state))

    provide(kUserContext, user)
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
    provide(kInstanceResourcePacks, resourcePacks)
    provide(kInstanceModsContext, instanceMods)
    provide(kInstanceFiles, files)
    provide(kLaunchTask, task)

    provide(kInstanceVersionInstall, install)

    provide(kInstanceShaderPacks, shaderPacks)
    provide(kResourcePackSearch, resourcePackSearch)
    provide(kShaderPackSearch, shaderPackSearch)
    provide(kModsSearch, modsSearch)
    provide(kModDependenciesCheck, useModDependenciesCheck(instance.path, instance.runtime, instanceMods.mods, instanceVersion.refreshResolvedVersion))
    provide(kModLibCleaner, useModLibCleaner(instanceMods.mods, instanceMods.allowLoaders))
    provide(kSaveSearch, useSavesSearch(saves.saves, saves.sharedSaves, searchModel))
    provide(kModUpgrade, modUpgrade)
    provide(kEnvironment, useEnvironment())
    provide(kTheme, useTheme(vuetify.framework))

    useI18nSync(vuetify.framework, settings.state)

    const router = useRouter()
    useExternalRoute(router)

    provide(kUILayout, useUILayout())
    provide(kImageDialog, useImageDialog())
    provide(kFilterCombobox, useFilterComboboxData())
    provide(kSupportedAuthorityMetadata, useSupportedAuthority())
    provide(kTutorial, useTutorialModel())
    provide(kModrinthTags, useModrinthTags())
    provide(kCurseforgeCategories, useCurseforgeCategories())

    return () => ctx.slots.default?.()
  },
})
