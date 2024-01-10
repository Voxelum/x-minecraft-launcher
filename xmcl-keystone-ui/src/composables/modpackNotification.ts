import { useResourceAdd } from '@/composables/resources'
import { LocalNotification, useNotifier } from './notifier'
import { ResourceDomain } from '@xmcl/runtime-api'
import { useDialog } from './dialog'
import { AddInstanceDialogKey } from './instanceTemplates'
import { InjectionKey, Ref } from 'vue'

export const kModpackNotification: InjectionKey<ReturnType<typeof useModpackNotification>> = Symbol('ModpackNotification')

export function useModpackNotification(queue: Ref<LocalNotification[]>) {
  const { isShown, show: showAddInstance } = useDialog(AddInstanceDialogKey)
  const { notify } = useNotifier(queue)
  const { t } = useI18n()
  const ignored = [] as string[]
  useResourceAdd(({ path, name }) => {
    setTimeout(() => {
      if (ignored.some(p => p === path)) {
        ignored.splice(ignored.indexOf(path), 1)
        return
      }
      if (!isShown.value) {
        notify({
          level: 'success',
          title: t('AppAddInstanceDialog.downloadedNotification', { name }),
          full: true,
          more: () => {
            showAddInstance(path)
          },
        })
      }
    }, 100)
  }, ResourceDomain.Modpacks)
  const ignore = (path: string) => {
    ignored.push(path)
  }
  return {
    ignore,
  }
}
