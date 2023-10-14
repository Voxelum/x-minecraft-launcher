import { kFilterCombobox, kSemaphores, useExternalRoute, useFilterComboboxData, useI18nSync, useSemaphores, useThemeSync } from '@/composables'
import { kBackground, useBackground } from '@/composables/background'
import { kColorTheme, useColorTheme } from '@/composables/colorTheme'
import { kDropHandler, useDropHandler } from '@/composables/dropHandler'
import { kExceptionHandlers, useExceptionHandlers } from '@/composables/exception'
import { kImageDialog, useImageDialog } from '@/composables/imageDialog'
import { kInstance, useInstance } from '@/composables/instance'
import { kInstanceFiles, useInstanceFiles } from '@/composables/instanceFiles'
import { kInstanceFilesDiagnose, useInstanceFilesDiagnose } from '@/composables/instanceFilesDiagnose'
import { kInstanceJava, useInstanceJava } from '@/composables/instanceJava'
import { kInstanceJavaDiagnose, useInstanceJavaDiagnose } from '@/composables/instanceJavaDiagnose'
import { kInstanceModsContext, useInstanceMods } from '@/composables/instanceMods'
import { kInstanceOptions, useInstanceOptions } from '@/composables/instanceOptions'
import { kInstanceResourcePacks, useInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { kInstanceVersion, useInstanceVersion } from '@/composables/instanceVersion'
import { kInstanceVersionDiagnose, useInstanceVersionDiagnose } from '@/composables/instanceVersionDiagnose'
import { kInstances, useInstances } from '@/composables/instances'
import { kJavaContext, useJavaContext } from '@/composables/java'
import { kLaunchStatus, useLaunchStatus } from '@/composables/launch'
import { kLaunchTask, useLaunchTask } from '@/composables/launchTask'
import { kModsSearch, useModsSearch } from '@/composables/modSearch'
import { kModUpgrade, useModUpgrade } from '@/composables/modUpgrade'
import { kModpacks, useModpacks } from '@/composables/modpack'
import { kMods, useMods } from '@/composables/mods'
import { kNotificationQueue, useNotificationQueue } from '@/composables/notifier'
import { kPeerState, usePeerState } from '@/composables/peers'
import { kInstanceSave, useInstanceSaves } from '@/composables/save'
import { kServerStatusCache, useServerStatusCache } from '@/composables/serverStatus'
import { kSettingsState, useSettingsState } from '@/composables/setting'
import { kUILayout, useUILayout } from '@/composables/uiLayout'
import { kMarketRoute, useMarketRoute } from '@/composables/useMarketRoute'
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
    provide(kVuetify, vuetify.framework)
    provide(kSemaphores, useSemaphores())
    provide(kExceptionHandlers, useExceptionHandlers())
    provide(kServerStatusCache, useServerStatusCache())
    provide(kNotificationQueue, useNotificationQueue())

    provide(kColorTheme, useColorTheme(computed(() => vuetify.framework.theme.dark)))
    provide(kBackground, useBackground())
    provide(kDropHandler, useDropHandler())

    const user = useUserContext()
    const java = useJavaContext()
    const localVersions = useLocalVersions()
    const instances = useInstances()
    const peerState = usePeerState()
    provide(kPeerState, peerState)
    const instance = useInstance(instances.selectedInstance, instances.instances)

    const settings = useSettingsState()
    const instanceVersion = useInstanceVersion(instance.instance, localVersions.versions)
    const instanceJava = useInstanceJava(instance.instance, instanceVersion.resolvedVersion, java.all)
    const options = useInstanceOptions(instance.instance)
    const saves = useInstanceSaves(instance.instance)
    const resourcePacks = useInstanceResourcePacks(options.gameOptions)
    const instanceMods = useInstanceMods(instance.path, instance.runtime, instanceJava.java)
    const files = useInstanceFiles(instance.path)
    const task = useLaunchTask(instance.path, instance.runtime, instanceVersion.versionHeader)

    const modsSearch = useModsSearch(instance.runtime, instanceMods.mods)
    const mods = useMods(modsSearch.keyword, modsSearch.modrinth, modsSearch.curseforge, modsSearch.cachedMods, modsSearch.instanceMods)
    const modUpgrade = useModUpgrade(instance.path, instance.runtime, mods.installed)

    const versionDiagnose = useInstanceVersionDiagnose(instance.runtime, instanceVersion.resolvedVersion, localVersions.versions)
    const javaDiagnose = useInstanceJavaDiagnose(java.all, instanceJava.java, instanceJava.recommendation)
    const filesDiagnose = useInstanceFilesDiagnose(files.files, files.install)
    const userDiagnose = useUserDiagnose(user.userProfile)

    provide(kUserContext, user)
    provide(kJavaContext, java)
    provide(kSettingsState, settings)
    provide(kInstances, instances)
    provide(kInstance, instance)
    provide(kLocalVersions, localVersions)
    provide(kLaunchStatus, useLaunchStatus())

    provide(kInstanceVersion, instanceVersion)
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

    provide(kModsSearch, modsSearch)
    provide(kMods, mods)
    provide(kModUpgrade, modUpgrade)
    provide(kModpacks, useModpacks())

    useI18nSync(vuetify.framework, settings.state)
    useThemeSync(vuetify.framework, settings.state)

    const router = useRouter()
    useExternalRoute(router)

    provide(kUILayout, useUILayout())
    provide(kImageDialog, useImageDialog())
    provide(kMarketRoute, useMarketRoute())
    provide(kFilterCombobox, useFilterComboboxData())
    provide(kYggdrasilServices, useYggdrasilServices())

    return () => ctx.slots.default?.()
  },
})
