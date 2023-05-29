import { injection } from '@/util/inject'
import { TaskState } from '@xmcl/runtime-api'
import { useDialog } from './dialog'
import { LaunchStatusDialogKey, kLaunchStatus, useLaunch } from './launch'
import { kInstanceVersionDiagnose } from './instanceVersionDiagnose'
import { kInstanceJavaDiagnose } from './instanceJavaDiagnose'
import { kInstanceFilesDiagnose } from './instanceFilesDiagnose'
import { kUserDiagnose } from './userDiagnose'
import { kLaunchTask } from './launchTask'
import { kInstanceFiles } from './instanceFiles'
import { kInstanceVersion } from './instanceVersion'

export interface LaunchMenuItem {
  title: string
  description: string
  icon?: string
  rightIcon?: string
  color?: string
}

export function useLaunchButton() {
  const launch = useLaunch()
  const { launchCount, launching } = injection(kLaunchStatus)
  const { show: showLaunchStatusDialog } = useDialog(LaunchStatusDialogKey)
  const { show: showMultiInstanceDialog } = useDialog('multi-instance-launch')

  const { issues: versionIssues, fix: fixVersionIssues, loading: loadingVersionIssues } = injection(kInstanceVersionDiagnose)
  const { issue: javaIssue, fix: fixJavaIssue } = injection(kInstanceJavaDiagnose)
  const { issue: filesIssue, fix: fixInstanceFileIssue } = injection(kInstanceFilesDiagnose)
  const { issue: userIssue, fix: fixUserIssue } = injection(kUserDiagnose)
  const { status, pause, resume } = injection(kLaunchTask)
  const { refreshing: refreshingFiles } = injection(kInstanceFiles)
  const { isValidating: isRefreshingVersion } = injection(kInstanceVersion)

  const { t } = useI18n()
  const launchButtonFacade = computed(() => {
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
    } else if (userIssue.value) {
      return {
        icon: 'account_circle',
        text: t('login.login'),
        color: 'blue',
        menu: [userIssue.value],
        onClick: () => fixUserIssue(),
      }
    } else if (javaIssue.value) {
      return {
        icon: 'get_app',
        text: t('install'),
        color: 'blue',
        menu: [javaIssue.value],
        onClick: () => fixJavaIssue(),
      }
    } else if (versionIssues.value.length > 0) {
      return {
        icon: 'get_app',
        text: t('install'),
        color: 'blue',
        menu: versionIssues.value,
        onClick: () => fixVersionIssues(),
      }
    } else if (filesIssue.value) {
      return {
        icon: 'get_app',
        text: t('install'),
        color: 'blue',
        menu: [filesIssue.value],
        onClick: () => fixInstanceFileIssue(),
      }
    } else {
      return {
        icon: 'play_arrow',
        text: t('launch.launch'),
        color: 'primary',
        right: true,
        onClick: () => {
          if (launching.value) {
            showLaunchStatusDialog()
          } else if (launchCount.value >= 1) {
            showMultiInstanceDialog()
          } else {
            launch()
          }
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
    isRefreshingVersion.value)
  const right = computed(() => launchButtonFacade.value.right || false)
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
    count: launchCount,
    onClick,
    color,
    icon,
    text,
    loading,
    right,
    menuItems,
  }
}
