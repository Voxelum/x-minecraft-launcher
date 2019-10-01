import VueI18n from 'vue-i18n';
import { inject, InjectionKey } from '@vue/composition-api';

export const I18N_SYMBOL: InjectionKey<VueI18n> = Symbol('VueI18n')

export function useI18n() {
    const i18n = inject(I18N_SYMBOL);
    if (!i18n) throw new Error('Cannot find i18n. Maybe router not loaded?');
    return {
        t(key: string, values?: any[] | { [key: string]: any }): string { return i18n.t(key, values) as any; },
    };
}