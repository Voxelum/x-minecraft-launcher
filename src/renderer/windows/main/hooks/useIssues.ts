import { provide } from '@vue/composition-api'
import { useDialog } from '.'
import { useJavaWizardDialog } from './useDialog'
import { IssueHandler, useModResource, useRouter, useService } from '/@/hooks'
import { IssueType } from '/@shared/entities/issue'
import { InstanceResourcePacksServiceKey } from '/@shared/services/InstanceResourcePacksService'

export function provideIssueHandler() {
  const { replace } = useRouter()
  const { show: showJavaDialog, javaIssue } = useJavaWizardDialog()
  const { show: showModDialog } = useDialog('download-missing-mods' as any) // TODO: fix this
  const { install: deploy } = useService(InstanceResourcePacksServiceKey)
  const { resources } = useModResource()

  const handlerRegistry: Record<string, () => void> = {}

  provide(IssueHandler, handlerRegistry)

  function register(issue: IssueType, f: () => void) {
    handlerRegistry[issue] = f
  }

  register('missingModsOnServer', showModDialog)
  register('unknownMod', () => replace('/mod-setting'))
  register('incompatibleMod', () => replace('/mod-setting'))
  register('incompatibleResourcePack', () => replace('/resource-pack-setting'))
  register('incompatibleJava', () => {
    javaIssue.value = 'incompatible'
    showJavaDialog()
  })
  register('missingJava', () => {
    javaIssue.value = 'missing'
    showJavaDialog()
  })
  register('requireForge', () => replace('/version-setting'))
  register('requireFabric', () => replace('/version-setting'))
  register('requireFabricAPI', () => {
    const fabric = resources.value.find((r) => r.type === 'fabric' && r.metadata.id === 'fabric')
    if (fabric) {
      deploy({ resources: [fabric] })
    } else {
      replace('/curseforge/mc-mods/306612')
    }
  })
}
