import { computed, Ref, ref } from '@vue/composition-api';
import Vue from 'vue';

export function useSelectionList<T, R>(
    items: Ref<R[]>,
    computeUnselectedItems: () => T[],
    computeSelecetedItems: () => T[],
    onFileDropped: (file: File) => void,
    mapItem: (item: T) => R,
) {
    const unselectedBuffer = ref(0);
    const selectedBuffer = ref(0);
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
    function onDropLeft(event: DragEvent) { return handleDrop(event, true); }
    function onDropRight(event: DragEvent) { return handleDrop(event, false); }

    function doInsert(index: number, toIndex: number) {
        if (index === toIndex) return;
        const copy = [...items.value]
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
    return {
        rightList,
        selecetedItems,
        unselectedItems,

        onItemVisibile,
        onMouseWheel,
        onDragOver,
        onDropLeft,
        onDropRight,
    }
}
