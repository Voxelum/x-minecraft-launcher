/**
 * @type {import('./setting').SettingModule}
 */
const mod = {
    state: {
        locale: '',
        locales: [],
        updateInfo: null,
        readyToUpdate: false,
        allowPrerelease: false,
        autoInstallOnAppQuit: false,
        downloadingUpdate: false,
        checkingUpdate: false,
        autoDownload: false,
        defaultBackgroundImage: null,
        defaultBlur: 0,
        useBmclAPI: true,
    },
    mutations: {
        downloadingUpdate(state, d) { state.downloadingUpdate = !!d; },
        checkingUpdate(state, d) { state.checkingUpdate = !!d; },
        updateInfo(state, updateInfo) {
            if (typeof updateInfo === 'object') state.updateInfo = updateInfo;
        },
        readyToUpdate(state, readyToUpdate) { state.readyToUpdate = readyToUpdate; },
        allowPrerelease(state, allowPrerelease) {
            if (typeof allowPrerelease === 'boolean') { state.allowPrerelease = allowPrerelease; }
        },
        autoInstallOnAppQuit(state, autoInstallOnAppQuit) {
            if (typeof autoInstallOnAppQuit === 'boolean') state.autoInstallOnAppQuit = autoInstallOnAppQuit;
        },
        autoDownload(state, autoDownload) {
            if (typeof autoDownload === 'boolean') state.autoDownload = autoDownload;
        },
        locale(state, language) {
            state.locale = language;
        },
        config(state, config) {
            state.locale = config.locale;
            state.locales = config.locales;
            state.autoDownload = config.autoDownload || false;
            state.autoInstallOnAppQuit = config.autoDownload || false;
            state.allowPrerelease = config.allowPrerelease || false;
            state.useBmclAPI = typeof config.useBmclAPI === 'boolean' ? config.useBmclAPI : true;
        },
        settings(state, settings) {
            // Object.assign(state.settings, settings);
        },
        defaultBackgroundImage(state, img) {
            if (typeof img === 'string') state.defaultBackgroundImage = img;
        },
        defaultBlur(state, blur) {
            if (typeof blur === 'number') state.defaultBlur = blur;
        },
        useBmclApi(state, use) {
            state.useBmclAPI = use;
        },
    },
};

export default mod;
