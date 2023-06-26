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
  const { importFile } = useService(ImportServiceKey)
  let dismiss = () => { }
  onMounted(() => {
    dismiss = registerHandler(() => {
    }, async (fileList) => {
      // drop the mod and enable the mod for instance
      const paths = [] as string[]
      for (let i = 0; i < fileList.files.length; i++) {
        const file = fileList.files[i]
        paths.push(file.path)
      }
      await Promise.all(paths.map((path) => importFile({
        resource: {
          path,
          domain: ResourceDomain.Mods,
        },
      })))
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
