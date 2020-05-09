import { onUnmounted, Ref, ref, watch, onMounted } from '@vue/composition-api';
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
    elem: Ref<HTMLElement | null | undefined>,
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
    onMounted(() => {
        if (elem.value) {
            elem.value.addEventListener('drop', onDrop);
        }
    });
    onUnmounted(() => {
        if (elem.value) {
            elem.value.removeEventListener('drop', onDrop);
        }
    });
}

/**
 * Let a drop on the element import to resource
 */
export function useDropImportFile(
    elem: Ref<HTMLElement | null>,
    handler: (file: File) => void,
) {
    function onDrop(event: DragEvent) {
        if (!event.dataTransfer) return;
        event.preventDefault();
        const length = event.dataTransfer.files.length;
        if (length < 0) return;
        console.log(`Detect drop import ${length} file(s).`);
        for (let i = 0; i < length; ++i) {
            handler(event.dataTransfer.files[i]);
        }
    }
    onMounted(() => {
        if (elem.value) {
            elem.value.addEventListener('drop', onDrop);
        }
    });
    onUnmounted(() => {
        if (elem.value) {
            elem.value.removeEventListener('drop', onDrop);
        }
    });
}

export function useDragTransferItem(elem: Ref<HTMLElement>, right: boolean, id: string) {
    function onDragStart(e: DragEvent) {
        e.dataTransfer!.setData('side', right ? 'right' : 'left');
        e.dataTransfer!.setData('id', id);
    }
    onMounted(() => {
        elem.value.classList.add('draggable-card');
        elem.value.setAttribute('draggable-id', id);
        elem.value.addEventListener('dragstart', onDragStart);
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
    insert: (from: string, to: string) => void,
    add: (id: string) => void,
    remove: (id: string) => void,
) {
    function handleDrop(event: DragEvent, left: boolean) {
        event.preventDefault();
        if (!event.dataTransfer) return;
        let side = event.dataTransfer.getData('side');
        let id = event.dataTransfer.getData('id');
        if (!id || !side) return;
        let y = event.clientY;
        if (side === 'left') {
            if (left) {
                // do nothing now...
            } else {
                add(id);
            }
        } else if (left) {
            remove(id);
        } else {
            let all = right.value!.getElementsByClassName('draggable-card');
            for (let i = 0; i < all.length; ++i) {
                let elem = all.item(i);
                if (!elem) continue;
                let targetId = elem.getAttribute('draggable-id')!;
                let rect: DOMRect = elem.getBoundingClientRect() as any;
                console.log(`${y} ${rect.y + rect.height}`);
                if (y < rect.y + rect.height) {
                    insert(id, targetId);
                    break;
                }
                if (i === all.length - 1) {
                    insert(id, targetId);
                }
            }
        }
    }

    function onMouseWheel(event: Event) { event.stopPropagation(); return true; }
    function onDragOver(event: Event) {
        event.preventDefault();
        return false;
    }
    function onDropLeft(event: DragEvent) { return handleDrop(event, true); }
    function onDropRight(event: DragEvent) { return handleDrop(event, false); }

    let leftRef: any;
    let rightRef: any;
    onMounted(() => {
        leftRef = left.value!;
        rightRef = right.value!;
        left.value!.addEventListener('drop', onDropLeft);
        left.value!.addEventListener('dragover', onDragOver);
        left.value!.addEventListener('wheel', onMouseWheel);

        right.value!.addEventListener('drop', onDropRight);
        right.value!.addEventListener('dragover', onDragOver);
        right.value!.addEventListener('wheel', onMouseWheel);
    });

    onUnmounted(() => {
        leftRef!.removeEventListener('drop', onDropLeft);
        leftRef!.removeEventListener('dragover', onDragOver);
        leftRef!.removeEventListener('wheel', onMouseWheel);

        rightRef!.removeEventListener('drop', onDropRight);
        rightRef!.removeEventListener('dragover', onDragOver);
        rightRef!.removeEventListener('wheel', onMouseWheel);
    });
}
