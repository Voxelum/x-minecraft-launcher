import { inject, InjectionKey, provide, Ref, ref } from '@vue/composition-api';
import { useIpc } from '@/hooks';
import { BuiltinNotification } from '@main/notification';

export type Type = 'success' | 'info' | 'warning' | 'error';
const STATUS_SYMBOL: InjectionKey<Ref<Type>> = Symbol('NotifierStatus');
const TITLE_SYMBOL: InjectionKey<Ref<string>> = Symbol('NotifierTitle');
const SHOW_SYMBOL: InjectionKey<Ref<boolean>> = Symbol('NotifierShowed');
const ACTION_SYMBOL: InjectionKey<Ref<(() => void) | undefined>> = Symbol('NotifierAction');
const NOTIFY_QUEUE_SYMBOL: InjectionKey<Ref<Array<BuiltinNotification>>> = Symbol('NotifierQueue');

export function provideNotifier() {
    const type: Ref<Type> = ref('success');
    const title: Ref<string> = ref('');
    const content: Ref<string> = ref('');
    const show: Ref<boolean> = ref(false);
    const action: Ref<(() => void) | undefined> = ref(() => { });
    provide(STATUS_SYMBOL, type);
    provide(TITLE_SYMBOL, title);
    provide(SHOW_SYMBOL, show);
    provide(ACTION_SYMBOL, action);

    const ipc = useIpc();
    ipc.on('notification', (event, payload) => {
        title.value = payload.title;
        content.value = payload.body;
        type.value = payload.level;
        show.value = true;
    });

    return { type, content, title, show, action };
}

export type Notify = (status: Type, title: string, more?: () => void) => void;

type NotifyOptions = string | [string, () => void];

export function useNotifier() {
    const stat = inject(STATUS_SYMBOL);
    const tit = inject(TITLE_SYMBOL);
    const show = inject(SHOW_SYMBOL);
    const action = inject(ACTION_SYMBOL);
    if (!stat || !show || !tit || !action) throw new Error('Cannot init notifier hook!');

    const notify: Notify = (status, title, more) => {
        stat.value = status;
        tit.value = title;
        action.value = more;
        show.value = true;
    };
    const subscribe = <T>(promise: Promise<T>, success?: (r: T) => NotifyOptions, failed?: (e: any) => NotifyOptions) => {
        promise.then((r) => {
            if (success) {
                let options = success(r);
                if (typeof options === 'string') {
                    notify('success', options);
                } else {
                    notify('success', options[0], options[1]);
                }
            }
        }, (e) => {
            if (failed) {
                let options = failed(e);
                if (typeof options === 'string') {
                    notify('error', options);
                } else {
                    notify('error', options[0], options[1]);
                }
            }
        });
    };
    const watcher = <T>(
        func: () => Promise<T>,
        success?: (r: T) => NotifyOptions,
        failed?: (e: any) => NotifyOptions,
    ) => () => subscribe(func(), success, failed);

    return {
        status: stat,
        title: tit,
        more: action,
        show,
        notify,
        subscribe,
        watcher,
    };
}
