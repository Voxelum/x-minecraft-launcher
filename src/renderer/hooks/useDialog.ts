import { computed, inject, InjectionKey, onMounted, onUnmounted, Ref, watch, provide, ref } from '@vue/composition-api';

export type Dialogs = 'task' | 'java-wizard' | 'login' | 'skin-import' | 'user-service'
    | 'crash-report' | 'feedback' | 'launch-status' | 'download-missing-mods' | 'logs'
    | 'challenge' | 'detail' | 'launch-blocked'
    | '';
export const DIALOG_SHOWING: InjectionKey<Ref<Dialogs>> = Symbol('ShowingDialog');
export const DIALOG_OPTION: InjectionKey<Ref<any>> = Symbol('DialogOption');
export const DIALOG_RESULT: InjectionKey<Ref<any>> = Symbol('DialogResult');

export function provideDialog() {
    const dialogShowing = ref('');
    const dialogOption = ref(undefined);
    const dialogResult = ref(undefined);
    provide(DIALOG_SHOWING, dialogShowing);
    provide(DIALOG_OPTION, dialogOption);
    provide(DIALOG_RESULT, dialogResult);

    return {
        dialogShowing,
        dialogOption,
        dialogResult,
    };
}

/**
 * Use a shared dialog between pages
 */
export function useDialog(dialog: Dialogs = '') {
    const showingDialog: Ref<Dialogs> = inject(DIALOG_SHOWING) as any;
    const dialogOption: Ref<any> = inject(DIALOG_OPTION) as any;
    const dialogResult: Ref<any> = inject(DIALOG_RESULT) as any;
    if (!showingDialog || !dialogOption || !dialogResult) throw new Error('This should not happend');
    function closeDialog(result?: any) {
        if (showingDialog.value === dialog) {
            showingDialog.value = '';
            dialogOption.value = undefined;
            dialogResult.value = result;
        }
    }
    function showDialog(newDialog: Dialogs = dialog, option?: any) {
        if (showingDialog.value !== '') {
            closeDialog(dialogResult.value);
            dialogOption.value = undefined;
            dialogResult.value = undefined;
        }
        showingDialog.value = newDialog;
        dialogOption.value = option;
    }
    const openListeners: Array<() => void> = [];
    const closeListeners: Array<(result: any) => void> = [];
    function onDialogOpened(f: () => void) {
        openListeners.push(f);
    }
    function onDialogClosed(f: (result: any) => void) {
        closeListeners.push(f);
    }
    let watcherHandle: () => void;
    onMounted(() => {
        watcherHandle = watch(showingDialog, (n, o) => {
            if (n === dialog) {
                openListeners.forEach(f => f());
            } else if (o === dialog) {
                closeListeners.forEach(f => f(dialogResult.value));
            }
        });
    });
    onUnmounted(() => {
        watcherHandle();
    });
    return {
        showDialog,
        dialogOption,
        dialogResult,
        closeDialog,
        showingDialog,
        onDialogOpened,
        onDialogClosed,
    };
}

export function useDialogSelf(dialog: Dialogs) {
    const { showingDialog, showDialog, closeDialog, dialogResult, dialogOption, onDialogOpened, onDialogClosed } = useDialog(dialog);
    return {
        showingDialog,
        showDialog,
        dialogOption,
        closeDialog,
        dialogResult,
        onDialogOpened,
        onDialogClosed,
        isShown: computed({
            get: () => showingDialog.value === dialog,
            set: (v: boolean) => { showingDialog.value = v ? dialog : ''; },
        }),
    };
}
