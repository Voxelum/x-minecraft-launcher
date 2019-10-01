import { inject, InjectionKey, Ref, provide, ref } from "@vue/composition-api";

export type Status = 'success' | 'info' | 'warning' | 'error';
const STATUS_SYMBOL: InjectionKey<Ref<Status>> = Symbol('NotifierStatus');
const CONTENT_SYMBOL: InjectionKey<Ref<string>> = Symbol('NotifierContent');

export function provideNotifier() {
    const status: Ref<Status> = ref('success');
    const content: Ref<string> = ref('success');
    provide(STATUS_SYMBOL, status);
    provide(CONTENT_SYMBOL, content);
    return { status, content };
}

export function useNotifier() {
    const stat = inject(STATUS_SYMBOL);
    const cont = inject(CONTENT_SYMBOL);
    if (!stat || !cont) throw new Error('Canno init notifier hook!')

    return {
        notify(status: Status, content: string) {
            stat.value = status;
            cont.value = content;
        }
    };
}
