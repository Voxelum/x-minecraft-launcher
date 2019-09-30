import { InjectionKey, provide, ref, Ref, computed } from "@vue/composition-api";

export type Dialogs = 'task' | 'java-wizard' | 'login' | '';
export const SHOWING: InjectionKey<Ref<Dialogs>> = Symbol('ShowingDialog');

export function useDialog(dialog: Dialogs = '') {
    const showingDialog = ref(dialog);
    provide(SHOWING, showingDialog);
    function show(newDialog: Dialogs = dialog) {
        showingDialog.value = newDialog;
    }
    return {
        show,
        showingDialog,
    };
}

export function useDialogSelf(dialog: Dialogs) {
    const { showingDialog, show } = useDialog(dialog);
    return {
        showingDialog,
        show,
        isShown: computed(() => showingDialog.value === dialog),
    };
}


