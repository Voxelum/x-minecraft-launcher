import VueI18n from 'vue-i18n';
import { inject, InjectionKey } from '@vue/composition-api';

export const I18N_SYMBOL: InjectionKey<VueI18n> = Symbol('VueI18n')

export function useI18n(): VueI18n & { t(): string } {
    const i18n = inject(I18N_SYMBOL);
    if (!i18n) throw new Error('Cannot find i18n. Maybe router not loaded?');
    return i18n as any;
}