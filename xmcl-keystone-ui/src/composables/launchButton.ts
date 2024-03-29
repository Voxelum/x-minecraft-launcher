import { injection } from '@/util/inject'
import { TaskState } from '@xmcl/runtime-api'
import { useDialog } from './dialog'
import { LaunchStatusDialogKey } from './launch'
import { kInstanceVersionDiagnose } from './instanceVersionDiagnose'
import { kInstanceJavaDiagnose } from './instanceJavaDiagnose'
import { kInstanceFilesDiagnose } from './instanceFilesDiagnose'
import { kUserDiagnose } from './userDiagnose'
import { kLaunchTask } from './launchTask'
import { kInstanceFiles } from './instanceFiles'
import { kInstanceVersion } from './instanceVersion'
import { kInstance } from './instance'
import { kInstanceLaunch } from './instanceLaunch'

export interface LaunchMenuItem {
  title: string
  description: string
  icon?: string
  rightIcon?: string
  color?: string
  onClick?: () => void
}

export function useLaunchButton() {
  const { show: showLaunchStatusDialog } = useDialog(LaunchStatusDialogKey)

  const { path } = injection(kInstance)
  const { issues: versionIssues, fix: fixVersionIssues, loading: loadingVersionIssues } = injection(kInstanceVersionDiagnose)
  const { issue: javaIssue, fix: fixJavaIssue } = injection(kInstanceJavaDiagnose)
  const { issue: filesIssue, fix: fixInstanceFileIssue } = injection(kInstanceFilesDiagnose)
  const { issue: userIssue, fix: fixUserIssue } = injection(kUserDiagnose)
  const { status, pause, resume } = injection(kLaunchTask)
  const { isValidating: refreshingFiles, mutate } = injection(kInstanceFiles)
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
    } else if (javaIssue.value && !javaIssue.value.onClick) {
      return {
        icon: 'get_app',
        text: t('install'),
        color: 'blue',
        menu: [javaIssue.value],
        onClick: () => fixJavaIssue(),
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
    dirty.value)
  const leftIcon = computed(() => launchButtonFacade.value.leftIcon)
  const menuItems = computed<LaunchMenuItem[]>(() => launchButtonFacade.value.menu || [])

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
