import { inject, InjectionKey, Ref, provide, ref } from '@vue/composition-api';

export type Status = 'success' | 'info' | 'warning' | 'error';
const STATUS_SYMBOL: InjectionKey<Ref<Status>> = Symbol('NotifierStatus');
const TITLE_SYMBOL: InjectionKey<Ref<string>> = Symbol('NotifierTitle');
const CONTENT_SYMBOL: InjectionKey<Ref<string>> = Symbol('NotifierContent');
const ERROR_SYMBOL: InjectionKey<Ref<any>> = Symbol('NotifierError');
const SHOW_SYMBOL: InjectionKey<Ref<boolean>> = Symbol('NotifierShowed');

export function provideNotifier() {
    const status: Ref<Status> = ref('success');
    const title: Ref<string> = ref('');
    const content: Ref<string> = ref('');
    const error: Ref<any> = ref(undefined);
    const show: Ref<boolean> = ref(false);
    provide(STATUS_SYMBOL, status);
    provide(TITLE_SYMBOL, title);
    provide(CONTENT_SYMBOL, content);
    provide(ERROR_SYMBOL, error);
    provide(SHOW_SYMBOL, show);

    return { status, content, title, error, show };
}

export type Notify = (status: Status, title: string, content?: string, e?: any) => void;

export function useNotifier() {
    const stat = inject(STATUS_SYMBOL);
    const cont = inject(CONTENT_SYMBOL);
    const error = inject(ERROR_SYMBOL);
    const tit = inject(TITLE_SYMBOL);
    const show = inject(SHOW_SYMBOL);
    if (!stat || !cont || !error || !show || !tit) throw new Error('Cannot init notifier hook!');

    const notify: Notify = (status, title, content, e) => {
        stat.value = status;
        tit.value = title;
        cont.value = content || '';
        show.value = true;
        error.value = e;
    };

    return {
        status: stat,
        title: tit,
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
                    notify('error', failed(e), '', e);
                }
            });
        },
    };
}
