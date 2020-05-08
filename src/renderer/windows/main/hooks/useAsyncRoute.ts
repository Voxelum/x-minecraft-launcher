import { inject, InjectionKey, provide } from '@vue/composition-api';

export const BEFORE_LEAVE: InjectionKey<Array<() => void | Promise<void>>> = Symbol('BEFORE_LEAVE');

export function provideAsyncRoute() {
    provide(BEFORE_LEAVE, []);
}

export function useAsyncRouteBeforeLeaves() {
    const beforeLeaves = inject(BEFORE_LEAVE);
    if (!beforeLeaves) throw new Error('MissingRouteBeforeLeave');
    return beforeLeaves;
}

export function useAsyncRoute() {
    let funcs = inject(BEFORE_LEAVE);
    if (!funcs) throw new Error('Illegal State');
    function beforeUnmount(func: () => void | Promise<void>) {
        if (!funcs) throw new Error('Illegal State');
        funcs.push(func);
    }
    return {
        beforeUnmount,
    };
}
