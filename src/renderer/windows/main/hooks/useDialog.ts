import { computed, inject, InjectionKey, provide, Ref, ref } from '@vue/composition-api';

export type DialogNames = 'task' | 'java-wizard' | 'login' | 'detail' | ''
    | 'user-service'
    | 'log' | 'feedback'
    | 'launch-status' | 'launch-blocked';

export const DIALOG_SYMBOL: InjectionKey<Ref<DialogNames>> = Symbol('ShowingDialog');

export function provideDialog() {
    const dialogShowing = ref('');
    provide(DIALOG_SYMBOL, dialogShowing);

    return {
        dialogShowing,
    };
}

/**
 * Use a shared dialog between pages
 */
export function useDialog(dialogName: DialogNames = '') {
    const shownDialog: Ref<DialogNames> = inject(DIALOG_SYMBOL) as any;
    if (!shownDialog) throw new Error('This should not happened');
    const isShown = computed({
        get: () => shownDialog.value === dialogName,
        set: (v: boolean) => { shownDialog.value = v ? dialogName : ''; },
    });
    function hide() {
        if (shownDialog.value === dialogName) {
            shownDialog.value = '';
        }
    }
    function show() {
        if (shownDialog.value !== dialogName) {
            shownDialog.value = dialogName;
        }
    }
    return {
        dialog: shownDialog,
        show,
        hide,
        isShown,
    };
}

export function useSingleDialog(isShown = ref(false)) {
    const show = () => { isShown.value = true; };
    const hide = () => { isShown.value = false; };
    return {
        isShown,
        show,
        hide,
    };
}

export function provideLoginDialog() {
    provide('login-switch-user', ref(false));
}

export function useLoginDialog() {
    const isSwitchingUser: Ref<boolean> = inject('login-switch-user') as any;
    if (!isSwitchingUser) throw new Error('This should not happened');
    return { isSwitchingUser, ...useDialog('login') };
}
