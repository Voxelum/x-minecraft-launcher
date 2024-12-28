import { NetworkException } from '@xmcl/runtime-api'
import { useDialog } from './dialog'
import { Notify } from './notifier'
import { useExceptionHandler } from '@/composables/exception'
import { useLocaleError } from './error'

export function useDefaultErrorHandler(notify: Notify) {
  const { show } = useDialog('feedback')
  const tError = useLocaleError()
  useExceptionHandler(NetworkException, (e) => {
    const message: string = tError(e)
    notify({
      title: message,
      level: 'error',
      more() {
        show()
      },
    })
  })
}
