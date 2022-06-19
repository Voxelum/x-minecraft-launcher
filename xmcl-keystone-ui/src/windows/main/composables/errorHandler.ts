import { HTTPException, ModrinthServiceKey } from '@xmcl/runtime-api'
import { useDialog } from './dialog'
import { useNotifier } from './notifier'
import { useI18n } from '/@/composables'
import { useExceptionHandler, useExceptionHandlerFromService } from '/@/composables/exception'

export function useDefaultErrorHandler() {
  const { t } = useI18n()
  const { notify } = useNotifier()
  const { show } = useDialog('feedback')
  useExceptionHandler(HTTPException, (e) => {
    notify({
      title: t('exception.http', { code: e.statusCode, url: e.url }),
      level: 'error',
      more() {
        show()
      },
      full: true,
    })
  })
}
