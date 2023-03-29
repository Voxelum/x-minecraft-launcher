import { injection } from '@/util/inject'
import { ImportServiceKey, InstanceModsServiceKey, ResourceDomain } from '@xmcl/runtime-api'
import { kDropHandler, useDropHandler } from './dropHandler'
import { useService } from './service'

/**
 * The mod handler when user drop file in mod page.
 *
 * This should directly install the mod into instance.
 */
export function useModDropHandler() {
  const { registerHandler, dragover } = injection(kDropHandler)
  // const { install } = useService(InstanceModsServiceKey)
  const { importFile } = useService(ImportServiceKey)
  let dismiss = () => { }
  onMounted(() => {
    dismiss = registerHandler(() => {
    }, async (fileList) => {
      // drop the mod and enable the mod for instance
      for (let i = 0; i < fileList.files.length; i++) {
        const file = fileList.files[i]
        await importFile({
          resource: {
            path: file.path,
            domain: ResourceDomain.Mods,
          },
        })
      }
    }, () => {
    })
  })
  onUnmounted(() => {
    dismiss()
  })
  return {
    dragover,
  }
}
