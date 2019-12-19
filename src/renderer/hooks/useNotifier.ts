import { inject, InjectionKey, Ref, provide, ref } from '@vue/composition-api';

export type Status = 'success' | 'info' | 'warning' | 'error';
const STATUS_SYMBOL: InjectionKey<Ref<Status>> = Symbol('NotifierStatus');
const CONTENT_SYMBOL: InjectionKey<Ref<string>> = Symbol('NotifierContent');
const ERROR_SYMBOL: InjectionKey<Ref<any>> = Symbol('NotifierError');
const SHOW_SYMBOL: InjectionKey<Ref<boolean>> = Symbol('NotifierShowed');

export function provideNotifier() {
    const status: Ref<Status> = ref('success');
    const content: Ref<string> = ref('');
    const error: Ref<any> = ref(undefined);
    const show: Ref<boolean> = ref(false);
    provide(STATUS_SYMBOL, status);
    provide(CONTENT_SYMBOL, content);
    provide(ERROR_SYMBOL, error);
    provide(SHOW_SYMBOL, show);

    return { status, content, error, show };
}

export function useNotifier() {
    const stat = inject(STATUS_SYMBOL);
    const cont = inject(CONTENT_SYMBOL);
    const error = inject(ERROR_SYMBOL);
    const show = inject(SHOW_SYMBOL);
    if (!stat || !cont || !error || !show) throw new Error('Cannot init notifier hook!');

    const notify = (status: Status, content: string, e?: any) => {
        stat.value = status;
        cont.value = content;
        show.value = true;
        error.value = e;
    };

    return {
        status: stat,
        content: cont,
        error,
        show,
        notify,
        subscribe<T>(promise: Promise<T>, success?: (r: T) => string, failed?: (e: any) => string) {
            promise.then((r) => {
                if (success) {
                    notify('success', success(r));
                }
            }, (e) => {
                if (failed) {
                    notify('error', failed(e), e);
                }
            });
        },
    };
}
