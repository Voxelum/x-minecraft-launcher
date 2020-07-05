import { computed, Ref } from '@vue/composition-api';
import { UpdateInfo } from 'electron-updater';
import { useStore } from './useStore';
import { useServiceOnly } from './useService';
import { useBusy } from './useSemaphore';

export function useSettings() {
    const { state, commit } = useStore();
    const locales = computed(() => state.setting.locales || []);
    const selectedLocale = computed({
        get: () => locales.value.find(l => l === state.setting.locale) || 'en',
        set: v => commit('locale', v),
    });
    const allowPrerelease = computed({
        get: () => state.setting.allowPrerelease,
        set: v => commit('allowPrerelease', v),
    });
    const autoInstallOnAppQuit = computed({
        get: () => state.setting.autoInstallOnAppQuit,
        set: v => commit('autoInstallOnAppQuit', v),
    });
    const autoDownload = computed({
        get: () => state.setting.autoDownload,
        set: v => commit('autoDownload', v),
    });
    const useBmclAPI = computed({
        get: () => state.setting.useBmclAPI,
        set: v => commit('useBmclApi', v),
    });
    const updateStatus = computed(() => state.setting.updateStatus);
    const checkingUpdate = useBusy('checkUpdate');
    const downloadingUpdate = useBusy('downloadUpdate');
    const updateInfo: Ref<UpdateInfo> = computed(() => state.setting.updateInfo || {}) as any;

    return {
        ...useServiceOnly('BaseService', 'checkUpdate'),
        locales,
        selectedLocale,
        allowPrerelease,
        autoDownload,
        autoInstallOnAppQuit,
        useBmclAPI,
        updateStatus,
        checkingUpdate,
        downloadingUpdate,
        updateInfo,
    };
}

export function useLauncherVersion() {
    const { state } = useStore();
    const version = computed(() => state.setting.version);
    const build = computed(() => state.setting.build);
    return {
        version,
        build,
    };
}

export function useUpdateInfo() {
    const { state } = useStore();
    const checkingUpdate = useBusy('checkUpdate');
    const downloadingUpdate = useBusy('downloadUpdate');
    const updateInfo = computed(() => state.setting.updateInfo);
    const updateStatus = computed(() => state.setting.updateStatus);
    return {
        checkingUpdate,
        downloadingUpdate,
        updateInfo,
        updateStatus,
        ...useServiceOnly('BaseService', 'downloadUpdate', 'quitAndInstall', 'checkUpdate'),
    };
}
