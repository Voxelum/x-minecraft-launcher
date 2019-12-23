import { computed, onUnmounted, Ref, ref, watch, onMounted } from '@vue/composition-api';
import Vue from 'vue';
import { useResourceOperation } from './useResource';

export function useDragging() {

}

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
    const { importResource } = useResourceOperation();
    function onDrop(event: DragEvent) {
        if (!event.dataTransfer) return;
        event.preventDefault();
        const length = event.dataTransfer.files.length;
        if (length > 0) {
            console.log(`Detect drop import ${length} file(s).`);
            for (let i = 0; i < length; ++i) {
                importResource({ path: event.dataTransfer.files[i].path, type: importHint });
            }
        }
    }
    const handle = watch(elem, (n, o) => {
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
        handle();
    });
}

export function useDragTransferItem(elem: Ref<HTMLElement>, right: boolean, id: string, index: number) {
    function onDragStart(e: DragEvent) {
        e.dataTransfer!.setData('index', `${right ? 'R' : 'L'}${index}`);
        e.dataTransfer!.setData('id', id);
    }
    const handle = watch(elem, (n, o) => {
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
        handle();
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

    const leftHandle = watch(left, (n, o) => {
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
    const rightHandle = watch(right, (n, o) => {
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
    onUnmounted(() => {
        rightHandle();
        leftHandle();
    });
}

export function useSelectionList<T, R>(
    items: Ref<R[]>,
    computeUnselectedItems: () => T[],
    computeSelecetedItems: () => T[],
    onFileDropped: (file: File) => void,
    mapItem: (item: T) => R,
) {
    const unselectedBuffer = ref(10);
    const selectedBuffer = ref(10);
    const rightList: Ref<Element> = ref(null) as any;
    const selecetedItems = computed(() => computeSelecetedItems().filter((_, i) => i < selectedBuffer.value));
    const unselectedItems = computed(() => computeUnselectedItems().filter((_, i) => i < unselectedBuffer.value));

    function onItemVisibile(visible: boolean, index: number, right: boolean) {
        if (!visible) return;
        if (right) {
            if (selectedBuffer.value - index < 5) {
                selectedBuffer.value += 10;
            }
        } else if (unselectedBuffer.value - index < 5) {
            unselectedBuffer.value += 10;
        }
    }
    function onMouseWheel(event: Event) { event.stopPropagation(); return true; }
    function onDragOver(event: Event) { event.preventDefault(); return false; }

    function doInsert(index: number, toIndex: number) {
        if (index === toIndex) return;
        const copy = [...items.value];
        const inserted = copy.splice(index, 1);
        copy.splice(toIndex, 0, ...inserted);
        items.value = copy;
    }
    function doSelect(index: number) {
        const newJoin = unselectedItems.value[index];
        const newItem: R = mapItem(newJoin);
        const copy = [...items.value || []];
        copy.unshift(newItem as any);
        items.value = copy;
    }
    function doUnselect(index: number) {
        const selected = [...selecetedItems.value || []];
        const willDelete = selected[index];
        const copy = [...items.value];
        Vue.delete(copy, copy.indexOf(mapItem(willDelete)));
        items.value = copy;
    }
    function handleDrop(event: DragEvent, left: boolean) {
        event.preventDefault();
        if (!event.dataTransfer) return;
        const length = event.dataTransfer.files.length;
        if (length > 0) {
            console.log(`Detect drop import ${length} file(s).`);
            for (let i = 0; i < length; ++i) {
                onFileDropped(event.dataTransfer.files[i]);
            }
        }
        const indexText = event.dataTransfer.getData('Index');
        if (indexText) {
            const index = Number.parseInt(indexText.substring(1), 10);
            const y = event.clientY;
            if (indexText[0] === 'L') {
                if (left) {
                    // do nothing now...
                } else {
                    doSelect(index);
                }
            } else if (left) {
                doUnselect(index);
            } else {
                const all = rightList.value.getElementsByClassName('draggable-card');
                for (let i = 0; i < all.length; ++i) {
                    const elem = all.item(i);
                    if (!elem) continue;
                    const rect: DOMRect = elem.getBoundingClientRect() as any;
                    console.log(`${y} ${rect.y + rect.height}`);
                    if (y < rect.y + rect.height) {
                        doInsert(index, i);
                        break;
                    }
                    if (i === all.length - 1) {
                        doInsert(index, all.length);
                    }
                }
            }
        }
    }
    function onDropLeft(event: DragEvent) { return handleDrop(event, true); }
    function onDropRight(event: DragEvent) { return handleDrop(event, false); }

    return {
        rightList,
        selecetedItems,
        unselectedItems,

        onItemVisibile,
        onMouseWheel,
        onDragOver,
        onDropLeft,
        onDropRight,
    };
}
