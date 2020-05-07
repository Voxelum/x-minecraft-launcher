import { Ref, onMounted } from '@vue/composition-api';
import Vue from 'vue';

export function useScrollToOnMount(elem: Ref<null | Vue | HTMLElement>, computeOffset: () => number) {
    onMounted(() => {
        let yOffset = computeOffset();
        let elemValue = elem.value;
        if (!elemValue) return;
        if (elemValue instanceof HTMLElement) {
            elemValue.scrollTo(0, yOffset);
        } else {
            elemValue.$el.scrollTo(0, yOffset);
        }
    });
}
