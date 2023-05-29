import { InjectionKey, Ref } from 'vue'
import { InstanceFile } from '@xmcl/runtime-api'
import { basename } from '@/util/basename'
import { CSSProperties } from 'vue/types/jsx'

export interface InstanceFileNode<T = never> {
  name: string
  path: string
  icon?: string
  avatar?: string
  style?: CSSProperties
  size: number
  data?: T
  children?: InstanceFileNode<T>[]
}

export const FileNodesSymbol: InjectionKey<Ref<InstanceFileNode<any>[]>> = Symbol('InstanceFileNode')

export type InstanceFileExportData = {
  forceOverride: boolean
  client: string
  server: string
  downloads?: string[]
  curseforge: boolean
}

export function useInstanceFileNodesFromLocal(local: Ref<InstanceFile[]>) {
  function getFileNode(f: InstanceFile): InstanceFileNode<InstanceFileExportData> {
    return reactive({
      name: basename(f.path),
      path: f.path,
      size: f.size,
      data: {
        client: '',
        server: '',
        forceOverride: false,
        downloads: f.downloads,
        curseforge: !!f.curseforge,
        modrinth: !!f.modrinth,
      },
      children: undefined,
    })
  }
  const result = ref(local.value.map(getFileNode))
  watch(local, (newVal) => {
    if (newVal.length > 0) {
      result.value = local.value.map(getFileNode)
    } else {
      result.value = []
    }
  })
  return result
}

export function provideFileNodes<T>(files: Ref<InstanceFileNode<T>[]>) {
  function buildEdges(cwd: InstanceFileNode<T>[], filePaths: string[], parent: string, file: InstanceFileNode<T>) {
    const remained = filePaths.slice(1)
    if (remained.length > 0) { // edge
      const name = filePaths[0]
      let edgeNode = cwd.find(n => n.name === name)
      const current = parent ? (parent + '/' + name) : name
      if (!edgeNode) {
        edgeNode = {
          name,
          path: current,
          size: 0,
          children: [],
        }
        cwd.push(edgeNode)
      }
      buildEdges(edgeNode.children!, remained, current, file)
      edgeNode.children?.sort((a, b) => a.path.localeCompare(b.path))
    } else { // leaf
      cwd.push(file)
    }
  }

  const leaves: Ref<InstanceFileNode<T>[]> = ref([])
  const nodes: Ref<InstanceFileNode<T>[]> = ref([])

  function update(files: InstanceFileNode<T>[]) {
    const leavesNodes = files
    const result: InstanceFileNode<T>[] = []
    for (const file of leavesNodes) {
      buildEdges(result, file.path.split('/'), '', file)
    }
    leaves.value = leavesNodes
    nodes.value = result
  }

  watch(files, (files) => {
    update(files)
  })

  update(files.value)

  provide(FileNodesSymbol, nodes)

  return { nodes, leaves }
}
