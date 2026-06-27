import { injection } from '@/util/inject'
import { isBedrockInstance } from '@xmcl/instance'
import { watchOnce } from '@vueuse/core'
import { InjectionKey } from 'vue'
import { useDialog } from './dialog'
import { kInstance } from './instance'
import { kInstanceFiles } from './instanceFiles'
import { kInstanceJava } from './instanceJava'
import { kInstanceJavaDiagnose } from './instanceJavaDiagnose'
import { kInstanceLaunch } from './instanceLaunch'
import { kInstanceVersion } from './instanceVersion'
import { useInstanceLaunchMenuItems } from './instanceLaunchMenuItems'
import { kInstanceVersionInstall } from './instanceVersionInstall'
import { kInstances } from './instances'
import { LaunchStatusDialogKey } from './launch'
import { kUserContext } from './user'
import { kLaunchTask } from './launchTask'
import { TaskState, BedrockServiceKey } from '@xmcl/runtime-api'
import { useService } from './service'
import { useTask } from './task'

export interface LaunchMenuItem {
  title: string
  description: string
  noDisplay?: boolean
  icon?: string
  rightIcon?: string
  color?: string
  onClick?: () => void
}

export const kLaunchButton: InjectionKey<ReturnType<typeof useLaunchButton>> =
  Symbol('LaunchButton')

export function useLaunchButton() {
  const { show: showLaunchStatusDialog } = useDialog(LaunchStatusDialogKey)

  const { path } = injection(kInstance)
  const { instance } = injection(kInstance)
  const isBedrock = computed(() => isBedrockInstance(instance.value))

  const { getInstallation, install: installBedrock, isRunning: isRunningBedrock, killGame: killBedrock } = useService(BedrockServiceKey)
  const bedrockInstalled = ref(true)
  const checkingBedrock = ref(false)
  const bedrockGameRunning = ref(false)

  async function checkBedrockInstallation() {
    if (!isBedrock.value) return
    checkingBedrock.value = true
    try {
      const status = await getInstallation()
      bedrockInstalled.value = status.installed
    } catch {
      bedrockInstalled.value = false
    } finally {
      checkingBedrock.value = false
    }
  }

  async function updateBedrockRunningStatus() {
    if (!isBedrock.value) {
      bedrockGameRunning.value = false
      return
    }
    try {
      const running = await isRunningBedrock()
      if (bedrockGameRunning.value && !running) {
        windowController.show()
      }
      bedrockGameRunning.value = running
    } catch {
      bedrockGameRunning.value = false
    }
  }

  let checkInterval: any = null

  watch(instance, () => {
    checkBedrockInstallation()
    updateBedrockRunningStatus()
  }, { immediate: true })

  watch(isBedrock, (active) => {
    if (checkInterval) {
      clearInterval(checkInterval)
      checkInterval = null
    }
    if (active) {
      updateBedrockRunningStatus()
      checkInterval = setInterval(updateBedrockRunningStatus, 2000)
    } else {
      bedrockGameRunning.value = false
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    if (checkInterval) {
      clearInterval(checkInterval)
    }
  })

  const { task: installTask, progress: installProgress, total: installTotal } = useTask((t) => t.type === 'installBedrock')
  const isInstalling = computed(() => installTask.value !== undefined)
  const installPercentage = computed(() => {
    if (installTotal.value > 0) {
      return Math.round((installProgress.value / installTotal.value) * 100)
    }
    return 0
  })

  watch(isInstalling, (v) => {
    if (!v) {
      checkBedrockInstallation()
    }
  })

  const { isValidating } = injection(kInstances)
  const { isValidating: refreshingJava } = injection(kInstanceJava)
  const { isValidating: refreshingFiles } = injection(kInstanceFiles)
  const { userProfile } = injection(kUserContext)

  const {
    fix: fixVersionIssues,
    instruction,
    loading: loadingVersionIssues,
    isInstanceFixing
  } = injection(kInstanceVersionInstall)
  const { issue: javaIssue } = injection(kInstanceJavaDiagnose)
  const { isValidating: isRefreshingVersion } = injection(kInstanceVersion)
  const { launch, launching, gameProcesses, count, abort } = injection(kInstanceLaunch)
  const { status, cancel } = injection(kLaunchTask)
  const { instanceInstallStatus } = injection(kInstanceFiles)

  const fixingInstance = computed(() => isInstanceFixing(path.value))
  const { launchMenuItems, issues, fixInstanceFileIssue, loadingInstanceFiles } =
    useInstanceLaunchMenuItems()

  const noUserLaunched = computed(() => {
    return gameProcesses.value.every(
      (p) => p.options.user.selectedProfile !== userProfile.value.selectedProfile,
    )
  })
  const hasGameRunning = computed(() => count.value > 0)
  const hasTaskRunning = computed(() => status.value === TaskState.Running)

  const { t, locale } = useI18n()
  const transition = computed(() => {
    const currentPath = path.value
    return (
      currentPath !== instruction.value?.instance ||
      currentPath !== instanceInstallStatus.value?.instance
    )
  })

  const launchButtonFacade = shallowRef<{
    text: string
    color: string
    icon?: string
    leftIcon?: string
    right?: boolean
    menu?: LaunchMenuItem[]
    onClick: () => void | Promise<void>
  }>({
    text: t('launch.launch'),
    color: 'primary',
    leftIcon: 'play_arrow',
    onClick: async () => {
      await fixInstanceFileIssue()
      if (javaIssue.value) {
        showLaunchStatusDialog({ javaIssue: javaIssue.value })
      } else {
        launch()
        showLaunchStatusDialog()
      }
    },
  })

  watch(
    [
      launching,
      hasGameRunning,
      noUserLaunched,
      hasTaskRunning,
      issues,

      javaIssue,
      locale,
      isBedrock,
      bedrockInstalled,
      isInstalling,
      installPercentage,
      bedrockGameRunning,
      // Rebuild the facade when the diagnosis items themselves change (e.g. the
      // unresolved-file count drops from 3 to 1). The `issues` bitmask stays
      // the same in that case, so without this the cached `menu` text is stale.
      launchMenuItems,
    ],
    ([launching, hasGameRunning, noUserLaunched, hasTaskRunning, issues]) => {
      console.log('update launch button facade')
      if (isBedrock.value) {
        // Bedrock instances have no Java/version/file install pipeline. Always
        // present a plain launch button (or a cancel button while spawning).
        if (launching) {
          launchButtonFacade.value = {
            icon: 'close',
            text: t('launch.cancel'),
            color: 'blue',
            right: true,
            menu: [],
            onClick: () => {
              abort()
            },
          }
        } else if (isInstalling.value) {
          launchButtonFacade.value = {
            text: `${t('shared.install')} ${installPercentage.value}%`,
            color: 'primary',
            leftIcon: 'get_app',
            onClick: () => {},
          }
        } else if (bedrockGameRunning.value) {
          launchButtonFacade.value = {
            icon: 'close',
            text: t('launch.kill'),
            color: 'blue',
            right: true,
            menu: [],
            onClick: async () => {
              try {
                await killBedrock()
                await updateBedrockRunningStatus()
              } catch (e) {
                console.error(e)
              }
            },
          }
        } else if (!bedrockInstalled.value) {
          launchButtonFacade.value = {
            text: t('shared.install'),
            color: 'primary',
            leftIcon: 'get_app',
            onClick: async () => {
              try {
                await installBedrock()
                await checkBedrockInstallation()
              } catch (e) {
                console.error(e)
              }
            },
          }
        } else {
          launchButtonFacade.value = {
            text: t('launch.launch'),
            color: 'primary',
            leftIcon: 'play_arrow',
            onClick: () => {
              launch()
            },
          }
        }
        return
      }
      if (hasTaskRunning) {
        launchButtonFacade.value = {
          icon: 'pause',
          text: t('task.pause'),
          color: 'blue',
          onClick: () => cancel(),
        }
      } else if (launching) {
        launchButtonFacade.value = {
          icon: 'close',
          text: t('launch.cancel'),
          color: 'blue',
          right: true,
          menu: [],
          onClick: () => {
            abort()
          },
        }
      } else if (hasGameRunning) {
        if (noUserLaunched) {
          launchButtonFacade.value = {
            text: t('launch.launch'),
            color: !javaIssue.value ? 'primary' : 'primary darken-1',
            leftIcon: 'play_arrow',
            onClick: async () => {
              await fixInstanceFileIssue()
              if (javaIssue.value) {
                showLaunchStatusDialog({ javaIssue: javaIssue.value })
              } else {
                launch()
                showLaunchStatusDialog()
              }
            },
          }
        } else {
          launchButtonFacade.value = {
            icon: 'close',
            text: t('launch.kill'),
            color: 'blue',
            right: true,
            menu: [],
            onClick: () => {
              showLaunchStatusDialog({ isKill: true })
            },
          }
        }
      } else if (issues) {
        launchButtonFacade.value = {
          icon: 'get_app',
          text: t('shared.install'),
          color: 'blue',
          menu: launchMenuItems.value.filter((i) => !i.noDisplay),
          onClick: async () => {
            Promise.allSettled([fixVersionIssues(), fixInstanceFileIssue()])
          },
        }
      } else {
        launchButtonFacade.value = {
          text: t('launch.launch'),
          color: !javaIssue.value ? 'primary' : 'primary darken-1',
          leftIcon: 'play_arrow',
          onClick: async () => {
            await fixInstanceFileIssue()
            if (javaIssue.value) {
              showLaunchStatusDialog({ javaIssue: javaIssue.value })
            } else {
              launch()
              showLaunchStatusDialog()
            }
          },
        }
      }
    },
    {
      immediate: true,
    },
  )

  /**
   * The launch button color.
   */
  const color = computed(() => launchButtonFacade.value.color)
  const icon = computed(() => launchButtonFacade.value.icon)
  const text = computed(() => launchButtonFacade.value.text)
  const loading = computed(
    () =>
      launching.value ||
      loadingVersionIssues.value ||
      refreshingFiles.value ||
      refreshingJava.value ||
      isRefreshingVersion.value ||
      loadingInstanceFiles.value ||
      isValidating.value ||
      fixingInstance.value ||
      transition.value ||
      checkingBedrock.value
  )

  const leftIcon = computed(() => launchButtonFacade.value.leftIcon)
  const menuItems = computed<LaunchMenuItem[]>(() =>
    transition.value ? [] : launchButtonFacade.value.menu || [],
  )

  const listeners = new Set<() => void | Promise<void>>()
  function usePreclickListener(listener: () => void) {
    listeners.add(listener)
    onBeforeUnmount(() => {
      listeners.delete(listener)
    })
  }

  /**
   * The button click listener.
   *
   * 1. User need to login
   * 2. User need to install java
   * 3. User need to install version and files
   *
   * Preclick listeners may reject to abort the launch chain (e.g. the
   * unauthenticated-warning dialog rejects when the user picks "Cancel").
   * Such rejections are intentional and not propagated.
   */
  async function onClick() {
    if (loading.value && !launching.value) {
      await new Promise<void>((resolve) => {
        const unwatch = watch(loading, (v) => {
          if (v) return
          unwatch()
          resolve()
        })
      })
      return
    }
    for (const listener of listeners) {
      try {
        await listener()
      } catch {
        return
      }
    }
    launchButtonFacade.value.onClick()
  }

  return {
    usePreclickListener,
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
