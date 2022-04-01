import { InjectionKey, Ref } from '@vue/composition-api'
import { DialogKey } from './dialog'

export const AppExportDialogKey: DialogKey<string> = 'export'

export interface ExportFileNode {
  name: string
  id: string
  size: number
  source: 'modrinth' | 'curseforge' | ''
  sources: string[]
  children?: ExportFileNode[]
}

export const FileNodesSymbol: InjectionKey<Ref<ExportFileNode[]>> = Symbol('FileNodes')
