import { useDialog } from '.'
import { useJavaWizardDialog } from './useDialog'
import { useModResource, useRouter, useService } from '/@/hooks'
import { Issue, IssueType } from '/@shared/entities/issue'
import { DiagnoseServiceKey } from '/@shared/services/DiagnoseService'
import { InstanceResourceServiceKey } from '/@shared/services/InstanceResourceService'

export function useIssueHandler() {
  const { fix: fixIssue } = useService(DiagnoseServiceKey)
  const { replace } = useRouter()
  const { show: showJavaDialog, javaIssue } = useJavaWizardDialog()
  const { show: showModDialog } = useDialog('download-missing-mods' as any) // TODO: fix this
  const { deploy } = useService(InstanceResourceServiceKey)
  const { resources } = useModResource()

  const handlerRegistry: Record<string, () => void> = {}

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

  function fix(issue: Issue, issues: readonly Issue[]) {
    console.log(`Fix issue ${issue.id}`)
    const handler = handlerRegistry[issue.id]
    if (handler) {
      handler()
    } else if (issue.autofix) {
      fixIssue(issues)
    } else {
      console.error(`Cannot fix the issue ${issue.id} as it's not implemented`)
    }
  }
  return { fix }
}
