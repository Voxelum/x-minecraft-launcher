import { kFilterCombobox, kSemaphores, useExternalRoute, useFilterComboboxData, useI18nSync, useSemaphores } from '@/composables'
import { kCurseforgeCategories, useCurseforgeCategories } from '@/composables/curseforge'
import { kDatabaseStatus, useDatabaseStatus } from '@/composables/databaseStatus'
import { kDropHandler, useDropHandler } from '@/composables/dropHandler'
import { kExceptionHandlers, useExceptionHandlers } from '@/composables/exception'
import { kImageDialog, useImageDialog } from '@/composables/imageDialog'
import { kInstance, useInstance } from '@/composables/instance'
import { kInstanceDefaultSource, useInstanceDefaultSource } from '@/composables/instanceDefaultSource'
import { kInstanceFiles, useInstanceFiles } from '@/composables/instanceFiles'
import { kInstanceJava, useInstanceJava } from '@/composables/instanceJava'
import { kInstanceLaunch, useInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceModsContext, useInstanceMods } from '@/composables/instanceMods'
import { kInstanceOptions, useInstanceOptions } from '@/composables/instanceOptions'
import { kInstanceResourcePacks, useInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { kInstanceShaderPacks, useInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { kInstanceVersion, useInstanceVersion } from '@/composables/instanceVersion'
import { kInstanceVersionInstall, useInstanceVersionInstallInstruction } from '@/composables/instanceVersionInstall'
import { kInstances, useInstances } from '@/composables/instances'
import { kJavaContext, useJavaContext } from '@/composables/java'
import { kLaunchTask, useLaunchTask } from '@/composables/launchTask'
import { kModsSearch, useModsSearch } from '@/composables/modSearch'
import { kModUpgrade, useModUpgrade } from '@/composables/modUpgrade'
import { kModrinthTags, useModrinthTags } from '@/composables/modrinth'
import { kNotificationQueue, useNotificationQueue } from '@/composables/notifier'
import { kPeerShared, usePeerConnections } from '@/composables/peers'
import { kResourcePackSearch, useResourcePackSearch } from '@/composables/resourcePackSearch'
import { kInstanceSave, useInstanceSaves } from '@/composables/instanceSave'
import { kSaveSearch, useSavesSearch } from '@/composables/savesSearch'
import { kServerStatusCache, useServerStatusCache } from '@/composables/serverStatus'
import { kSettingsState, useSettingsState } from '@/composables/setting'
import { kShaderPackSearch, useShaderPackSearch } from '@/composables/shaderPackSearch'
import { useTelemetryTrack } from '@/composables/telemetryTrack'
import { kTheme, useTheme } from '@/composables/theme'
import { kTutorial, useTutorialModel } from '@/composables/tutorial'
import { kUILayout, useUILayout } from '@/composables/uiLayout'
import { kUserContext, useUserContext } from '@/composables/user'
import { kLocalVersions, useLocalVersions } from '@/composables/versionLocal'
import { kYggdrasilServices, useYggdrasilServices } from '@/composables/yggrasil'
import { vuetify } from '@/vuetify'
import 'virtual:uno.css'
import { provide } from 'vue'

export default defineComponent({
  setup(props, ctx) {
    provide(kSemaphores, useSemaphores())
    provide(kServerStatusCache, useServerStatusCache())
    const queue = useNotificationQueue()
    provide(kNotificationQueue, queue)

    provide(kDropHandler, useDropHandler())

    const user = useUserContext()
    const java = useJavaContext()
    const localVersions = useLocalVersions()
    const instances = useInstances()
    const instance = useInstance(instances.selectedInstance, instances.instances)
    provide(kPeerShared, usePeerConnections(queue))

    const settings = useSettingsState()
    const instanceVersion = useInstanceVersion(instance.instance, localVersions.versions, localVersions.servers)
    const instanceJava = useInstanceJava(instance.instance, instanceVersion.resolvedVersion, java.all)
    const instanceDefaultSource = useInstanceDefaultSource(instance.path)
    const options = useInstanceOptions(instance.path)
    const saves = useInstanceSaves(instance.path)
    const resourcePacks = useInstanceResourcePacks(instance.path, options.gameOptions)
    const instanceMods = useInstanceMods(instance.path, instance.runtime, instanceJava.java)
    const shaderPacks = useInstanceShaderPacks(instance.path, instance.runtime, instanceMods.mods, options.gameOptions)
    const files = useInstanceFiles(instance.path)
    const task = useLaunchTask(instance.path, instance.runtime, instanceVersion.versionId)
    const instanceLaunch = useInstanceLaunch(instance.instance, instanceVersion.versionId, instanceVersion.serverVersionId, instanceJava.java, user.userProfile, settings, instanceMods.enabledModCounts)

    const modsSearch = useModsSearch(instance.runtime, instanceMods.mods, instanceMods.isValidating)
    const modUpgrade = useModUpgrade(instance.path, instance.runtime, modsSearch.all)

    const resourcePackSearch = useResourcePackSearch(instance.runtime, resourcePacks.enabled, resourcePacks.disabled, resourcePacks.enabledSet)
    const shaderPackSearch = useShaderPackSearch(instance.runtime, shaderPacks.shaderPack)

    const install = useInstanceVersionInstallInstruction(instance.path, instance.instances, instanceVersion.resolvedVersion, localVersions.versions, localVersions.servers, java.all)

    useTelemetryTrack(settings.state)

    provide(kDatabaseStatus, useDatabaseStatus())

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
    provide(kSaveSearch, useSavesSearch(instance.runtime, saves.saves, saves.sharedSaves))
    provide(kModUpgrade, modUpgrade)
    provide(kTheme, useTheme(vuetify.framework))

    useI18nSync(vuetify.framework, settings.state)

    const router = useRouter()
    useExternalRoute(router)

    provide(kUILayout, useUILayout())
    provide(kImageDialog, useImageDialog())
    provide(kFilterCombobox, useFilterComboboxData())
    provide(kYggdrasilServices, useYggdrasilServices())
    provide(kTutorial, useTutorialModel())
    provide(kModrinthTags, useModrinthTags())
    provide(kCurseforgeCategories, useCurseforgeCategories())

    return () => ctx.slots.default?.()
  },
})
