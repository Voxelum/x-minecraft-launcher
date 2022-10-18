import { UserServiceKey } from '@xmcl/runtime-api'
import { useNotifier } from './notifier'
import { useService } from '/@/composables'

export function useAuthProfileImportNotification() {
  const { t } = useI18n()
  const { notify } = useNotifier()
  const { on } = useService(UserServiceKey)
  on('auth-profile-added', (name) => {
    notify({
      title: t('authProfileAddedNotification', { name }),
      level: 'success',
    })
  })
}
