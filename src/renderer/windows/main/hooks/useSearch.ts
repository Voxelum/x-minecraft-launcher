import { InjectionKey, inject, ref, Ref, onMounted, onUnmounted, provide } from '@vue/composition-api';

export const SEARCH_TEXT_SYMBOL: InjectionKey<Ref<string>> = Symbol('search-text');
export const SEARCH_TOGGLE_SYMBOL: InjectionKey<Ref<Array<(shown?: boolean) => void>>> = Symbol('search-toggle');

export function useSearch() {
    const text = inject(SEARCH_TEXT_SYMBOL, ref(''));

    return { text };
}

export function useSearchToggle() {
    const toggle = inject(SEARCH_TOGGLE_SYMBOL, ref(() => { }));
    return { toggle };
}

export function provideSearchToggle() {
    const toggle = ref([(shown?: boolean) => { }]);
    function handleKeydown(e: KeyboardEvent) {
        if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
            toggle.value[0]();
        }
    }
    function handleKeyup(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            toggle.value[0](true);
        }
    }
    onMounted(() => {
        document.addEventListener('keyup', handleKeyup);
        document.addEventListener('keydown', handleKeydown);
    });
    onUnmounted(() => {
        document.addEventListener('keyup', handleKeyup);
        document.addEventListener('keydown', handleKeydown);
    });
    provide(SEARCH_TOGGLE_SYMBOL, toggle);
    return { toggle };
}

// export function provideSearch(elem: Ref<HTMLElement>) {
//     const { shown } = useSearch();
//     function handleKeydown(e: KeyboardEvent) {
//         if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
//             if (show.value && !focused.value) {
//                 Vue.nextTick(() => {
//                     self.value.focus();
//                 });
//             } else {
//                 show.value = !show.value;
//                 Vue.nextTick(() => {
//                     self.value.focus();
//                 });
//             }
//         }
//     }
//     function handleKeyup(e: KeyboardEvent) {
//         if (e.key === 'Escape') {
//             show.value = false;
//         }
//     }
//     onMounted(() => {
//         document.addEventListener('keyup', handleKeyup);
//         document.addEventListener('keydown', handleKeydown);
//     });
//     onUnmounted(() => {
//         document.addEventListener('keyup', handleKeyup);
//         document.addEventListener('keydown', handleKeydown);
//     });
// }
