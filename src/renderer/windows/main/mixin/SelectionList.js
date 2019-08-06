import Vue from 'vue';

export default {
    data() {
        return {
            unselectedBuffer: 10,
            selectedBuffer: 10,
        };
    },
    methods: {
        checkBuffer(visible, index, right) {
            if (!visible) return;
            if (right) {
                if (this.selectedBuffer - index < 5) {
                    this.selectedBuffer += 10;
                }
            } else if (this.unselectedBuffer - index < 5) {
                this.unselectedBuffer += 10;
            }
        },

        onMouseWheel(event) { event.stopPropagation(); return true; },
        onDragOver(event) { event.preventDefault(); return false; },
        onDropLeft(event) { return this.handleDrop(event, true); },
        onDropRight(event) { return this.handleDrop(event, false); },
        doInsert(index, toIndex) {
            if (index === toIndex) return;
            const items = [...this.items || []];
            console.log('insert');
            const inserted = items.splice(index, 1);
            items.splice(toIndex, 0, ...inserted);
            this.items = items;
        },
        doSelect(index) {
            const newJoin = this.unselectedItems[index];
            const newItem = this.mapItem(newJoin);
            const items = [...this.items || []];
            items.unshift(newItem);
            this.items = items;
        },
        doUnselect(index) {
            const items = [...this.items || []];
            Vue.delete(items, index);
            this.items = items;
        },
        mapItem(i) {
            return i.hash;
        },
        handleDrop(event, left) {
            event.preventDefault();
            const length = event.dataTransfer.files.length;
            if (length > 0) {
                console.log(`Detect drop import ${length} file(s).`);
                for (let i = 0; i < length; ++i) {
                    this.dropFile(event.dataTransfer.files[i]);
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
                        this.doSelect(index);
                    }
                } else if (left) {
                    this.doUnselect(index);
                } else {
                    const rightList = this.$el.getElementsByClassName('right').item(0);
                    const all = rightList.getElementsByClassName('draggable-card');
                    for (let i = 0; i < all.length; ++i) {
                        const rect = all.item(i).getBoundingClientRect();
                        console.log(`${y} ${rect.y + rect.height}`);
                        if (y < rect.y + rect.height) {
                            this.doInsert(index, i);
                            break;
                        }
                        if (i === all.length - 1) {
                            this.doInsert(index, all.length);
                        }
                    }
                }
            }
        },
    },
};
