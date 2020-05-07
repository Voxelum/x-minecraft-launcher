import { onUnmounted, Ref, ref, watch } from '@vue/composition-api';
import { useResourceOperation } from './useResource';

export function useProgressiveLoad() {
    const buffer = ref(10);
    function onItemVisibile(visible: boolean, index: number) {
        if (!visible) return;
        if (buffer.value - index < 5) {
            buffer.value += 10;
        }
    }
    function filter(i: any, index: number) {
        return index < buffer.value;
    }
    return {
        onItemVisibile,
        filter,
    };
}

/**
 * Let a drop on the element import to resource
 */
export function useDropImport(
    elem: Ref<HTMLElement | null>,
    importHint?: string,
) {
    const { importUnknownResource } = useResourceOperation();
    function onDrop(event: DragEvent) {
        if (!event.dataTransfer) return;
        event.preventDefault();
        const length = event.dataTransfer.files.length;
        if (length > 0) {
            console.log(`Detect drop import ${length} file(s).`);
            for (let i = 0; i < length; ++i) {
                importUnknownResource({ path: event.dataTransfer.files[i].path, type: importHint });
            }
        }
    }
    watch(elem, (n, o) => {
        console.log(n);
        if (o) {
            o.removeEventListener('drop', onDrop);
        }
        if (n) {
            n.addEventListener('drop', onDrop);
        }
    });
    onUnmounted(() => {
        if (elem.value) {
            elem.value.removeEventListener('drop', onDrop);
        }
    });
}

export function useDragTransferItem(elem: Ref<HTMLElement>, right: boolean, id: string, index: number) {
    function onDragStart(e: DragEvent) {
        e.dataTransfer!.setData('index', `${right ? 'R' : 'L'}${index}`);
        e.dataTransfer!.setData('id', id);
    }
    watch(elem, (n, o) => {
        if (o) {
            o.removeEventListener('dragstart', onDragStart);
        }
        if (n) {
            elem.value.classList.add('draggable-card');
            elem.value.setAttribute('draggable-index', index.toString());
            n.addEventListener('dragstart', onDragStart);
        }
    });
    onUnmounted(() => {
        if (elem.value) {
            elem.value.removeEventListener('dragstart', onDragStart);
        }
    });
}

export function useDragTransferList(
    left: Ref<null | HTMLElement>,
    right: Ref<null | HTMLElement>,
    swap: (from: number, to: number) => void,
    add: (index: number) => void,
    remove: (index: number) => void,
) {
    function handleDrop(event: DragEvent, left: boolean) {
        event.preventDefault();
        console.log('Drop from sele list');
        if (!event.dataTransfer) return;
        const indexText = event.dataTransfer.getData('index');
        if (indexText) {
            const index = Number.parseInt(indexText.substring(1), 10);
            const y = event.clientY;
            if (indexText[0] === 'L') {
                if (left) {
                    // do nothing now...
                } else {
                    add(index);
                }
            } else if (left) {
                remove(index);
            } else {
                const all = right.value!.getElementsByClassName('draggable-card');
                for (let i = 0; i < all.length; ++i) {
                    const elem = all.item(i);
                    if (!elem) continue;
                    const targetIndex = Number.parseInt(elem.getAttribute('draggable-index')!, 10);
                    const rect: DOMRect = elem.getBoundingClientRect() as any;
                    console.log(`${y} ${rect.y + rect.height}`);
                    if (y < rect.y + rect.height) {
                        swap(index, targetIndex);
                        break;
                    }
                    if (i === all.length - 1) {
                        swap(index, targetIndex);
                    }
                }
            }
        }
    }

    function onMouseWheel(event: Event) { event.stopPropagation(); return true; }
    function onDragOver(event: Event) { event.preventDefault(); return false; }
    function onDropLeft(event: DragEvent) { return handleDrop(event, true); }
    function onDropRight(event: DragEvent) { return handleDrop(event, false); }

    watch(left, (n, o) => {
        if (o) {
            o.removeEventListener('drop', onDropLeft);
            o.removeEventListener('dragover', onDragOver);
            o.removeEventListener('wheel', onMouseWheel);
        }
        if (n) {
            n.addEventListener('drop', onDropLeft);
            n.addEventListener('dragover', onDragOver);
            n.addEventListener('wheel', onMouseWheel);
        }
    });
    watch(right, (n, o) => {
        if (o) {
            o.removeEventListener('drop', onDropRight);
            o.removeEventListener('dragover', onDragOver);
            o.removeEventListener('wheel', onMouseWheel);
        }
        if (n) {
            n.addEventListener('drop', onDropRight);
            n.addEventListener('dragover', onDragOver);
            n.addEventListener('wheel', onMouseWheel);
        }
    });
}
