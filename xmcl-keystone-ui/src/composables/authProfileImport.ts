import { useService } from '@/composables'
import { UserServiceKey } from '@xmcl/runtime-api'
import { Notify } from './notifier'

export function useAuthProfileImportNotification(notify: Notify) {
  const { t } = useI18n()
  const { on } = useService(UserServiceKey)
  on('auth-profile-added', (name) => {
    notify({
      title: t('authProfileAddedNotification', { name }),
      level: 'success',
    })
  })
}
