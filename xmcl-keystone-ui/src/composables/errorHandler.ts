import { HTTPException } from '@xmcl/runtime-api'
import { useDialog } from './dialog'
import { Notify } from './notifier'
import { useExceptionHandler } from '@/composables/exception'

export function useDefaultErrorHandler(notify: Notify) {
  const { t } = useI18n()
  const { show } = useDialog('feedback')
  useExceptionHandler(HTTPException, (e) => {
    notify({
      title: t('exception.http', { statusCode: e.statusCode, url: e.url, code: e.code }),
      level: 'error',
      more() {
        show()
      },
      full: true,
    })
  })
}
