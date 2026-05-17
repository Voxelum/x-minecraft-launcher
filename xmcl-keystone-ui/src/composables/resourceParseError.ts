import { ResourceErrorAction, ResourceErrorActionTuple } from '@xmcl/resource'
import { ResourceState, SharedState } from '@xmcl/runtime-api'
import { Ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { basename } from '@/util/basename'
import { useNotifier } from './notifier'

/**
 * Surface `ResourceState.errors` updates as user-facing toasts so the
 * user can see exactly which file the resource subsystem could not
 * parse (broken zip, permission denied, …).
 *
 * The upstream `watchResourcesDirectory` pushes one `Upsert` per failing
 * file (via the `ParseException` → `errorsUpdates` channel) and one
 * `Remove` once the file disappears or starts parsing again. We toast on
 * `Upsert` only, with the basename in the title and the full path / code
 * in the body — same shape as the other warning toasts in the app.
 */
export function useResourceParseErrorNotifier(state: Ref<SharedState<ResourceState> | undefined>) {
  const { t } = useI18n()
  const { notify } = useNotifier()

  watch(state, (s, _, onCleanup) => {
    if (!s) return
    const handler = (ops: ResourceErrorActionTuple[]) => {
      for (const [payload, action] of ops) {
        if (action !== ResourceErrorAction.Upsert) continue
        const err = payload as { path: string; code: string }
        if (!err?.path) continue
        notify({
          level: 'warning',
          icon: 'broken_image',
          title: t('resourceError.title', { file: basename(err.path) }),
          body: t('resourceError.body', { path: err.path, code: err.code }),
        })
      }
    }
    s.subscribe('errorsUpdates', handler)
    onCleanup(() => {
      s.unsubscribe('errorsUpdates', handler)
    })
  }, { immediate: true })
}
