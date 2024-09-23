import { injection } from '@/util/inject'
import { TaskState } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { useDialog } from './dialog'
import { kInstance } from './instance'
import { kInstanceFiles } from './instanceFiles'
import { useInstanceFilesDiagnose } from './instanceFilesDiagnose'
import { useInstanceJavaDiagnose } from './instanceJavaDiagnose'
import { kInstanceLaunch } from './instanceLaunch'
import { kInstanceVersion } from './instanceVersion'
import { kInstanceVersionInstall } from './instanceVersionInstall'
import { kInstances } from './instances'
import { LaunchStatusDialogKey } from './launch'
import { kLaunchTask } from './launchTask'
import { useUserDiagnose } from './userDiagnose'
import { useInstanceVersionDiagnose } from './instanceVersionDiagnose'

export interface LaunchMenuItem {
  title: string
  description: string
  icon?: string
  rightIcon?: string
  color?: string
  onClick?: () => void
}

export const kLaunchButton: InjectionKey<ReturnType<typeof useLaunchButton>> = Symbol('LaunchButton')

export function useLaunchButton() {
  const { show: showLaunchStatusDialog } = useDialog(LaunchStatusDialogKey)

  const { path } = injection(kInstance)
  const { isValidating } = injection(kInstances)
  const { isValidating: refreshingFiles, mutate } = injection(kInstanceFiles)

  const { fix: fixVersionIssues, loading: loadingVersionIssues } = injection(kInstanceVersionInstall)
  const versionIssues = useInstanceVersionDiagnose()
  const { issue: javaIssue } = useInstanceJavaDiagnose()
  const { issue: filesIssue, fix: fixInstanceFileIssue } = useInstanceFilesDiagnose()
  const { issue: userIssue, fix: fixUserIssue } = useUserDiagnose()
  const { status, pause, resume } = injection(kLaunchTask)
  const { isValidating: isRefreshingVersion } = injection(kInstanceVersion)
  const { launch, launching, count, kill } = injection(kInstanceLaunch)

  const { t } = useI18n()
  const dirty = ref(false)
  watch(path, () => {
    dirty.value = true
  })
  const launchButtonFacade = computed(() => {
    console.log('update button facade')
    if (
      !loadingVersionIssues.value &&
      !refreshingFiles.value &&
      !isRefreshingVersion.value
    ) {
      dirty.value = false
    }
    if (status.value === TaskState.Running) {
      return {
        icon: 'pause',
        text: t('task.pause'),
        color: 'blue',
        onClick: () => pause(),
      }
    } else if (status.value === TaskState.Paused) {
      return {
        icon: 'get_app',
        text: t('install'),
        color: 'blue',
        onClick: () => resume(),
      }
    } else if (launching.value) {
      return {
        icon: 'close',
        text: t('launch.cancel'),
        color: 'blue',
        right: true,
        menu: [],
        onClick: () => {
          kill()
        },
      }
    } else if (count.value > 0) {
      return {
        icon: 'close',
        text: t('launch.kill'),
        color: 'blue',
        right: true,
        menu: [],
        onClick: () => {
          showLaunchStatusDialog(true)
        },
      }
    } else if (userIssue.value) {
      return {
        icon: 'account_circle',
        text: t('login.login'),
        color: 'blue',
        menu: [userIssue.value],
        onClick: () => fixUserIssue(),
      }
    } else if (filesIssue.value) {
      return {
        icon: 'get_app',
        text: t('install'),
        color: 'blue',
        menu: [filesIssue.value],
        onClick: () => fixInstanceFileIssue(),
      }
    } else if (versionIssues.value.length > 0) {
      return {
        icon: 'get_app',
        text: t('install'),
        color: 'blue',
        menu: versionIssues.value,
        onClick: () => fixVersionIssues(),
      }
    } else {
      return {
        text: t('launch.launch'),
        color: !javaIssue.value ? 'primary' : 'primary darken-1',
        leftIcon: 'play_arrow',
        menu: javaIssue.value ? [javaIssue.value] : [],
        onClick: async () => {
          await mutate().catch(() => { })
          await fixInstanceFileIssue()
          await launch()
          showLaunchStatusDialog(false)
        },
      }
    }
  })

  /**
   * The launch button color.
   */
  const color = computed(() => launchButtonFacade.value.color)
  const icon = computed(() => launchButtonFacade.value.icon)
  const text = computed(() => launchButtonFacade.value.text)
  const loading = computed(() => launching.value ||
    loadingVersionIssues.value ||
    refreshingFiles.value ||
    isRefreshingVersion.value ||
    isValidating.value ||
    dirty.value)
  const leftIcon = computed(() => launchButtonFacade.value.leftIcon)
  const menuItems = computed<LaunchMenuItem[]>(() => dirty.value ? [] : launchButtonFacade.value.menu || [])

  /**
   * The button click listener.
   *
   * 1. User need to login
   * 2. User need to install java
   * 3. User need to install version and files
   */
  function onClick() {
    launchButtonFacade.value.onClick()
  }

  return {
    count,
    onClick,
    color,
    icon,
    text,
    loading,
    leftIcon,
    menuItems,
  }
}
