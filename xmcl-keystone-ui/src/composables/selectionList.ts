import { onUnmounted, Ref, ref, watch, onMounted } from 'vue'
import { ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import { useService } from './service'

export function useProgressiveLoad() {
  const buffer = ref(10)
  function onItemVisibile(visible: boolean, index: number) {
    if (!visible) return
    if (buffer.value - index < 5) {
      buffer.value += 10
    }
  }
  function filter(i: any, index: number) {
    return index < buffer.value
  }
  return {
    onItemVisibile,
    filter,
  }
}

/**
 * Let a drop on the element import to resource
 */
export function useDropImport(
  elem: Ref<HTMLElement | null | undefined>,
  domain?: ResourceDomain,
) {
  const { importResources } = useService(ResourceServiceKey)
  function onDrop(event: DragEvent) {
    if (!event.dataTransfer) return
    event.preventDefault()
    const length = event.dataTransfer.files.length
    if (length > 0) {
      console.log(`Detect drop import ${length} file(s).`)
      const resources = [] as Array<{ path: string; domain?: ResourceDomain }>
      for (let i = 0; i < length; ++i) {
        resources.push({ path: event.dataTransfer.files[i].path, domain })
      }
      importResources(resources)
    }
  }
  onMounted(() => {
    if (elem.value) {
      elem.value.addEventListener('drop', onDrop)
    }
  })
  onUnmounted(() => {
    if (elem.value) {
      elem.value.removeEventListener('drop', onDrop)
    }
  })
}

/**
 * Let a drop on the element import to resource
 */
export function useDropImportFile(
  elem: Ref<HTMLElement | null>,
  handler: (file: File) => void,
) {
  function onDrop(event: DragEvent) {
    if (!event.dataTransfer) return
    event.preventDefault()
    const length = event.dataTransfer.files.length
    if (length < 0) return
    console.log(`Detect drop import ${length} file(s).`)
    for (let i = 0; i < length; ++i) {
      handler(event.dataTransfer.files[i])
    }
  }
  onMounted(() => {
    if (elem.value) {
      elem.value.addEventListener('drop', onDrop)
    }
  })
  onUnmounted(() => {
    if (elem.value) {
      elem.value.removeEventListener('drop', onDrop)
    }
  })
}

export function useDragTransferItemMutable(elem: Ref<HTMLElement>, item: Ref<{ id: string; side: string }>) {
  let memo: HTMLElement
  function onDragStart(e: DragEvent) {
    e.dataTransfer!.effectAllowed = 'move'
    e.dataTransfer!.setData('side', item.value.side)
    e.dataTransfer!.setData('id', item.value.id)
  }
  function setup() {
    const element = elem.value
    if (element) {
      memo = element
      element.classList.add('draggable-card')
      element.setAttribute('draggable-id', item.value.id)
      element.addEventListener('dragstart', onDragStart)
    }
  }
  watch(item, setup)
  onMounted(setup)
  onUnmounted(() => {
    if (memo) {
      memo.removeEventListener('dragstart', onDragStart)
    }
  })
}

export function useDragTransferItem(elem: Ref<HTMLElement>, id: string, side: string) {
  let memo: HTMLElement
  function onDragStart(e: DragEvent) {
    e.dataTransfer!.setData('side', side)
    e.dataTransfer!.setData('id', id)
  }
  onMounted(() => {
    const element = elem.value
    if (element) {
      memo = element
      element.classList.add('draggable-card')
      element.setAttribute('draggable-id', id)
      element.addEventListener('dragstart', onDragStart)
    }
  })
  onUnmounted(() => {
    if (memo) {
      memo.removeEventListener('dragstart', onDragStart)
    }
  })
}

// eslint-disable-next-line no-undef
function findIntersectElement(y: number, all: HTMLCollectionOf<Element>) {
  for (let i = 0; i < all.length; ++i) {
    const elem = all.item(i)
    if (!elem) continue
    const rect: DOMRect = elem.getBoundingClientRect() as any
    if (y < rect.y + rect.height) {
      return elem
    }
  }
  return null
}

export function useDragTransferList(
  left: Ref<null | HTMLElement>,
  right: Ref<null | HTMLElement>,
  insert: (from: string, to: string) => void,
  add: (id: string, to?: string) => void,
  remove: (id: string) => void,
) {
  function handleDrop(event: DragEvent, left: boolean) {
    event.preventDefault()
    if (!event.dataTransfer) return
    const side = event.dataTransfer.getData('side')
    const id = event.dataTransfer.getData('id')
    if (!id || !side) return
    const y = event.clientY
    if (side === 'left') {
      if (left) {
        // do nothing now...
      } else {
        const all = right.value!.getElementsByClassName('draggable-card')
        const elem = findIntersectElement(y, all) || all.item(all.length - 1)
        add(id, elem?.getAttribute('draggable-id') ?? undefined)
      }
    } else if (left) {
      remove(id)
    } else {
      const all = right.value!.getElementsByClassName('draggable-card')
      const elem = findIntersectElement(y, all) || all.item(all.length - 1)
      const targetId = elem!.getAttribute('draggable-id')!
      insert(id, targetId)
    }
  }

  function onMouseWheel(event: Event) { event.stopPropagation(); return true }
  function onDragOver(event: Event) {
    event.preventDefault()
    return false
  }
  function onDropLeft(event: DragEvent) { return handleDrop(event, true) }
  function onDropRight(event: DragEvent) { return handleDrop(event, false) }

  let leftRef: any
  let rightRef: any
  onMounted(() => {
    leftRef = left.value!
    rightRef = right.value!
    left.value!.addEventListener('drop', onDropLeft)
    left.value!.addEventListener('dragover', onDragOver)
    left.value!.addEventListener('wheel', onMouseWheel)

    right.value!.addEventListener('drop', onDropRight)
    right.value!.addEventListener('dragover', onDragOver)
    right.value!.addEventListener('wheel', onMouseWheel)
  })

  onUnmounted(() => {
    leftRef!.removeEventListener('drop', onDropLeft)
    leftRef!.removeEventListener('dragover', onDragOver)
    leftRef!.removeEventListener('wheel', onMouseWheel)

    rightRef!.removeEventListener('drop', onDropRight)
    rightRef!.removeEventListener('dragover', onDragOver)
    rightRef!.removeEventListener('wheel', onMouseWheel)
  })
}
