import Vue from 'vue';
import { reactive } from '@vue/composition-api';

function useSelectionList<T, R>(
    mapItem: <T, R>(item: T) => R,
    selecetedItems: T[],
    unselectedItems: T[],
    dropFile: (file: File) => void,
    rightList: Element,
) {
    const items: R[] = [];
    const data = reactive({
        unselectedBuffer: 10,
        selectedBuffer: 10,
        items,
    });
    function checkBuffer(visible: boolean, index: number, right: boolean) {
        if (!visible) return;
        if (right) {
            if (data.selectedBuffer - index < 5) {
                data.selectedBuffer += 10;
            }
        } else if (data.unselectedBuffer - index < 5) {
            data.unselectedBuffer += 10;
        }
    }
    function onMouseWheel(event: Event) { event.stopPropagation(); return true; }
    function onDragOver(event: Event) { event.preventDefault(); return false; }
    function onDropLeft(event: DragEvent) { return handleDrop(event, true); }
    function onDropRight(event: DragEvent) { return handleDrop(event, false); }

    function doInsert(index: number, toIndex: number) {
        if (index === toIndex) return;
        const items = [...data.items || []];
        const inserted = items.splice(index, 1);
        items.splice(toIndex, 0, ...inserted);
        data.items = items;
    }
    function doSelect(index: number) {
        const newJoin = unselectedItems[index];
        const newItem = mapItem(newJoin);
        const items = [...data.items || []];
        items.unshift(newItem);
        data.items = items;
    }
    function doUnselect(index: number) {
        const selected = [...selecetedItems || []];
        const willDelete = selected[index];
        const items = [...data.items];
        Vue.delete(items, items.indexOf(mapItem(willDelete)));
        data.items = items;
    }
    function handleDrop(event: DragEvent, left: boolean) {
        event.preventDefault();
        if (!event.dataTransfer) return;
        const length = event.dataTransfer.files.length;
        if (length > 0) {
            console.log(`Detect drop import ${length} file(s).`);
            for (let i = 0; i < length; ++i) {
                dropFile(event.dataTransfer.files[i]);
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
                const all = rightList.getElementsByClassName('draggable-card');
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
        checkBuffer,
        onMouseWheel,
        onDragOver,
        onDropLeft,
        onDropRight,
    }
}
