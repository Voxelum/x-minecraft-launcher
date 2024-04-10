import { kFilterCombobox, kSemaphores, useExternalRoute, useFilterComboboxData, useI18nSync, useSemaphores } from '@/composables'
import { kDatabaseStatus, useDatabaseStatus } from '@/composables/databaseStatus'
import { kDropHandler, useDropHandler } from '@/composables/dropHandler'
import { kExceptionHandlers, useExceptionHandlers } from '@/composables/exception'
import { kImageDialog, useImageDialog } from '@/composables/imageDialog'
import { kInstance, useInstance } from '@/composables/instance'
import { kInstanceDefaultSource, useInstanceDefaultSource } from '@/composables/instanceDefaultSource'
import { kInstanceFiles, useInstanceFiles } from '@/composables/instanceFiles'
import { kInstanceFilesDiagnose, useInstanceFilesDiagnose } from '@/composables/instanceFilesDiagnose'
import { kInstanceJava, useInstanceJava } from '@/composables/instanceJava'
import { kInstanceJavaDiagnose, useInstanceJavaDiagnose } from '@/composables/instanceJavaDiagnose'
import { kInstanceLaunch, useInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceModsContext, useInstanceMods } from '@/composables/instanceMods'
import { kInstanceOptions, useInstanceOptions } from '@/composables/instanceOptions'
import { kInstanceResourcePacks, useInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { kInstanceShaderPacks, useInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { kInstanceVersion, useInstanceVersion } from '@/composables/instanceVersion'
import { kInstanceVersionDiagnose, useInstanceVersionDiagnose } from '@/composables/instanceVersionDiagnose'
import { kInstances, useInstances } from '@/composables/instances'
import { kJavaContext, useJavaContext } from '@/composables/java'
import { kLaunchTask, useLaunchTask } from '@/composables/launchTask'
import { kModsSearch, useModsSearch } from '@/composables/modSearch'
import { kModUpgrade, useModUpgrade } from '@/composables/modUpgrade'
import { kNotificationQueue, useNotificationQueue } from '@/composables/notifier'
import { kPeerState, usePeerState } from '@/composables/peers'
import { kResourcePackSearch, useResourcePackSearch } from '@/composables/resourcePackSearch'
import { kInstanceSave, useInstanceSaves } from '@/composables/save'
import { kServerStatusCache, useServerStatusCache } from '@/composables/serverStatus'
import { kSettingsState, useSettingsState } from '@/composables/setting'
import { kShaderPackSearch, useShaderPackSearch } from '@/composables/shaderPackSearch'
import { useTelemetryTrack } from '@/composables/telemetryTrack'
import { kTheme, useTheme } from '@/composables/theme'
import { kTutorial, useTutorialModel } from '@/composables/tutorial'
import { kUILayout, useUILayout } from '@/composables/uiLayout'
import { kUserContext, useUserContext } from '@/composables/user'
import { kUserDiagnose, useUserDiagnose } from '@/composables/userDiagnose'
import { kLocalVersions, useLocalVersions } from '@/composables/versionLocal'
import { kVuetify } from '@/composables/vuetify'
import { kYggdrasilServices, useYggdrasilServices } from '@/composables/yggrasil'
import { vuetify } from '@/vuetify'
import 'virtual:windi.css'
import { provide } from 'vue'

export default defineComponent({
  setup(props, ctx) {
    useTelemetryTrack()
    provide(kVuetify, vuetify.framework)
    provide(kSemaphores, useSemaphores())
    provide(kExceptionHandlers, useExceptionHandlers())
    provide(kServerStatusCache, useServerStatusCache())
    const queue = useNotificationQueue()
    provide(kNotificationQueue, queue)

    provide(kDropHandler, useDropHandler())

    const user = useUserContext()
    const java = useJavaContext()
    const localVersions = useLocalVersions()
    const instances = useInstances()
    const peerState = usePeerState(user.gameProfile)
    provide(kPeerState, peerState)
    const instance = useInstance(instances.selectedInstance, instances.instances)

    const settings = useSettingsState()
    const instanceVersion = useInstanceVersion(instance.instance, localVersions.versions)
    const instanceJava = useInstanceJava(instance.instance, instanceVersion.resolvedVersion, java.all)
    const instanceDefaultSource = useInstanceDefaultSource(instance.path)
    const options = useInstanceOptions(instance.path)
    const saves = useInstanceSaves(instance.path)
    const resourcePacks = useInstanceResourcePacks(instance.path, options.gameOptions)
    const instanceMods = useInstanceMods(instance.path, instance.runtime, instanceJava.java)
    const shaderPacks = useInstanceShaderPacks(instance.path, instance.runtime, instanceMods.mods, options.gameOptions)
    const files = useInstanceFiles(instance.path)
    const task = useLaunchTask(instance.path, instance.runtime, instanceVersion.versionHeader)
    const instanceLaunch = useInstanceLaunch(instance.instance, instanceVersion.resolvedVersion, instanceJava.java, user.userProfile, settings)

    const modsSearch = useModsSearch(instance.runtime, instanceMods.mods, instanceMods.isValidating)
    const modUpgrade = useModUpgrade(instance.path, instance.runtime, modsSearch.all)

    const resourcePackSearch = useResourcePackSearch(instance.runtime, resourcePacks.enabled, resourcePacks.disabled)
    const shaderPackSearch = useShaderPackSearch(instance.runtime, shaderPacks.shaderPack)

    const versionDiagnose = useInstanceVersionDiagnose(instance.path, instance.runtime, instanceVersion.resolvedVersion, localVersions.versions)
    const javaDiagnose = useInstanceJavaDiagnose(instance.path, java.all, instanceJava.java, instanceJava.recommendation, queue)
    const filesDiagnose = useInstanceFilesDiagnose(files.files, files.install)
    const userDiagnose = useUserDiagnose(user.userProfile)

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

    provide(kInstanceVersionDiagnose, versionDiagnose)
    provide(kInstanceJavaDiagnose, javaDiagnose)
    provide(kInstanceFilesDiagnose, filesDiagnose)
    provide(kUserDiagnose, userDiagnose)

    provide(kInstanceShaderPacks, shaderPacks)
    provide(kResourcePackSearch, resourcePackSearch)
    provide(kShaderPackSearch, shaderPackSearch)
    provide(kModsSearch, modsSearch)
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

    return () => ctx.slots.default?.()
  },
})
