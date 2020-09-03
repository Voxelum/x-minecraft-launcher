import { InjectionKey, inject, ref, Ref, onMounted, onUnmounted, provide } from '@vue/composition-api';

export const SEARCH_TEXT_SYMBOL: InjectionKey<Ref<string>> = Symbol('search-text');
export const SEARCH_TOGGLE_SYMBOL: InjectionKey<Ref<Array<(shown?: boolean) => void>>> = Symbol('search-toggle');

export function useSearch() {
    const text = inject(SEARCH_TEXT_SYMBOL, ref(''));
    return { text };
}

export function useSearchToggles() {
    const toggles = inject(SEARCH_TOGGLE_SYMBOL, ref([]));
    const toggle = (shown?: boolean) => {
        toggles.value[0]?.(shown);
    };
    return { toggles, toggle };
}

export function useSearchToggle(func: (shown?: boolean) => void) {
    const { toggles } = useSearchToggles();
    onMounted(() => {
        toggles.value.unshift(func);
    });
    onUnmounted(() => {
        toggles.value.shift();
    });
}

export function provideSearch() {
    const toggles = ref([(shown?: boolean) => { }]);
    const text = ref('');
    const toggle = (shown?: boolean) => {
        toggles.value[0]?.(shown);
    };
    function handleKeydown(e: KeyboardEvent) {
        if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
            toggle();
        }
    }
    function handleKeyup(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            toggle(true);
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
    provide(SEARCH_TEXT_SYMBOL, text);
    provide(SEARCH_TOGGLE_SYMBOL, toggles);
    return { toggle, text, toggles };
}
