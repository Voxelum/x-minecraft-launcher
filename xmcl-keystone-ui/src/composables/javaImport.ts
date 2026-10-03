import { JavaServiceKey, type Java } from '@xmcl/runtime-api'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getErrorMessage } from '@/util/error'
import { useService } from './service'

export function useJavaImport(onAdded: (java: Java) => void) {
  const { resolveJava } = useService(JavaServiceKey)
  const { t } = useI18n()
  const importing = ref(false)
  const error = ref('')

  async function browse() {
    if (importing.value) return
    importing.value = true
    error.value = ''
    try {
      const { canceled, filePaths } = await windowController.showOpenDialog({
        title: t('java.importFromFile'),
        properties: ['openFile'],
      })
      if (canceled || !filePaths[0]) return
      const java = await resolveJava(filePaths[0])
      if (!java) {
        error.value = `${t('java.invalid')}: ${filePaths[0]}`
        return
      }
      onAdded(java)
    } catch (e) {
      error.value = getErrorMessage(e)
    } finally {
      importing.value = false
    }
  }

  return { browse, importing, error }
}
