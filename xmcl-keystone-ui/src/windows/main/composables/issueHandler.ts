import { provide } from '@vue/composition-api'
import { IssueHandler, IssueHandlerKey, useModResource, useRouter, useService } from '/@/composables'
import { Issue, InstanceModsServiceKey, IssueKey } from '@xmcl/runtime-api'
import { useDialog } from './dialog'

export function provideIssueHandler() {
  const { push } = useRouter()
  const { show: showModDialog } = useDialog('download-missing-mods' as any) // TODO: fix this
  const { install } = useService(InstanceModsServiceKey)
  const { resources } = useModResource()

  provide(IssueHandlerKey, new IssueHandler())

  // register('missingModsOnServer', showModDialog)
  // register('unknownMod', () => push('/mod-setting'))
  // register('incompatibleMod', () => push('/mod-setting'))
  // register('incompatibleResourcePack', () => push('/resource-pack-setting'))
  // register('requireForge', () => push('/version-setting'))
  // register('requireFabric', () => push('/version-setting'))
  // register('requireFabricAPI', () => {
  //   const fabric = resources.value.find((r) => r.type === 'fabric' && r.metadata.id === 'fabric')
  //   if (fabric) {
  //     install({ mods: [fabric] })
  //   } else {
  //     push('/curseforge/mc-mods/306612')
  //   }
  // })
}
