import { InjectionKey, Ref } from '@vue/composition-api'
import { InstanceUpdate, LocalInstanceFile } from '@xmcl/runtime-api'
import { useI18n } from '/@/composables'
import { basename } from '/@/util/basename'

export interface InstanceFileNode {
  name: string
  id: string
  size: number
  choice: string | string[]
  choices: Array<{ value: string; text: string }>
  children?: InstanceFileNode[]
}

export const FileNodesSymbol: InjectionKey<Ref<InstanceFileNode[]>> = Symbol('InstanceFileNode')

export function useInstanceFileNodesFromLocal(local: Ref<LocalInstanceFile[]>, options: { curseforge: boolean; modrinth: boolean; downloads: boolean }) {
  const { t } = useI18n()
  function getChoices(f: LocalInstanceFile) {
    const result = [] as Array<{ value: string; text: string }>
    if (f.curseforge && options.curseforge) {
      result.push({ value: 'curseforge', text: t('exportModpackTarget.curseforge') })
    }
    if (f.modrinth && options.modrinth) {
      result.push({ value: 'modrinth', text: t('exportModpackTarget.modrinth') })
    }
    if (f.downloads && options.downloads) {
      result.push({ value: 'downloads', text: t('exportModpackTarget.downloads') })
    }
    if (result.length > 0) {
      result.unshift({ value: '', text: t('exportModpackTarget.override') })
    }
    return result
  }
  function getFileNode(f: LocalInstanceFile): InstanceFileNode {
    return reactive({
      name: basename(f.path),
      id: f.path,
      size: f.size,
      choice: '',
      choices: computed(() => getChoices(f)),
      children: f.isDirectory ? [] : undefined,
    })
  }
  return computed(() => local.value.map(getFileNode))
}

export function provideFileNodes(files: Ref<InstanceFileNode[]>) {
  function buildEdges(cwd: InstanceFileNode[], filePaths: string[], parent: string, file: InstanceFileNode) {
    const remained = filePaths.slice(1)
    if (remained.length > 0) { // edge
      const name = filePaths[0]
      let edgeNode = cwd.find(n => n.name === name)
      const current = parent ? (parent + '/' + name) : name
      if (!edgeNode) {
        edgeNode = {
          name,
          id: current,
          size: 0,
          choice: '',
          choices: [],
          children: [],
        }
        cwd.push(edgeNode)
      }
      buildEdges(edgeNode.children!, remained, current, file)
    } else { // leaf
      cwd.push(file)
    }
  }

  const leaves: Ref<InstanceFileNode[]> = ref([])
  const nodes: Ref<InstanceFileNode[]> = ref([])

  watch(files, (files) => {
    const leavesNodes = files
    const result: InstanceFileNode[] = []
    for (const file of leavesNodes) {
      buildEdges(result, file.id.split('/'), '', file)
    }
    leaves.value = leavesNodes
    nodes.value = result
  })

  provide(FileNodesSymbol, nodes)

  return { nodes, leaves }
}
