import I18nManager from "./I18nManager";
import zh from "../utils/locales/zh-CN.json";
import en from "../utils/locales/en.json";

describe('I18nManager', () => {
    describe('t', () => {
        test('should translate', () => {
            const manager = new I18nManager();
            expect(manager.getLocale()).toEqual(en);
            expect(manager.getLocaleName()).toEqual('en');
            expect(manager.t('checkUpdate')).toEqual(en.checkUpdate);
        });
    });
    describe('setLocale', () => {
        test('should change locale', () => {
            const manager = new I18nManager();
            manager.setLocale('zh-CN');
            expect(manager.getLocale()).toEqual(zh);
            expect(manager.getLocaleName()).toEqual('zh-CN');
            expect(manager.t('checkUpdate')).toEqual(zh.checkUpdate);
        });
    });
});
