import { Store } from 'vuex';
import assert from 'assert';
import fs from 'fs-extra';
import template from '../../src/index';

before(() => {
    fs.removeSync('./test/assets')
})
/**
 * @type {Store}
 */
let store;
describe('store', ($done) => {
    it('should load correctly', (done) => {
        template('./test/assets').then((str) => {
            assert(str);
            store = str;
            done()
        }).catch((e) => { done(e) })
    })
})

describe('gameprofile', () => {
    it('should fetch minecraft profile', async () => {
        // await store.dispatch('gameprofile/fetch', {service: 'mojang', uuid: })
    })
})

describe('appearance', () => {
    it('should be able to get theme', async () => {
        assert(typeof store.getters.theme === 'string');
        assert(typeof store.getters.themeMeta === 'object');
        assert(store.getters.themes instanceof Array);
        assert(typeof store.getters.themeMeta === 'object');
    })
    it('should be able to switch theme', async () => {
        await store.dispatch('updateSetting', { theme: 'material' })
        assert.equal(store.getters.theme, 'material')
        await store.dispatch('updateSetting', { theme: 'semantic' })
        assert.equal(store.getters.theme, 'semantic')
    })
    it('should be able to get theme metadata', () => {
        assert(typeof store.getters.themeMeta === 'object');
    })
    it('should be able to update theme metadata', async () => {
        await store.dispatch('toggleTheme', { value: 'a', nested: { value: 'b' } })
        const meta = store.getters.themeMeta;
        assert.equal(meta.value, 'a');
        assert.equal(meta.nested.value, 'b')
    })
    it('should be able to get default resolution', async () => {
        const res = store.getters.defaultResolution;
        assert(typeof res === 'object')
        assert(typeof res.height === 'number')
        assert(typeof res.width === 'number')
        assert(typeof res.fullscreen === 'boolean')
    });
    it('should be able to set default resolution', async () => {
        await store.dispatch('setDefaultResolution', { height: 1000, width: 900, fullscreen: false })
        assert.equal(store.getters.defaultResolution.height, 1000)
        assert.equal(store.getters.defaultResolution.width, 900)
        assert.equal(store.getters.defaultResolution.fullscreen, false)
        await store.dispatch('setDefaultResolution', { height: 600, width: 1000, fullscreen: true })
        assert.equal(store.getters.defaultResolution.height, 600)
        assert.equal(store.getters.defaultResolution.width, 1000)
        assert.equal(store.getters.defaultResolution.fullscreen, true)
    })
})

describe('i18n', () => {
    it('should be able to get current language', async () => {
        assert(typeof store.getters.language === 'string')
    })
    it('should be able to set current language', async () => {
        await store.dispatch('setLanguage', 'en')
        assert.equal(store.getters.language, 'en')
        await store.dispatch('setLanguage', 'cn')
        assert.equal(store.getters.language, 'cn')
    })
})

describe('java', () => {
    it('should be able to getCurrent Javas', () => {
        assert(store.getters.javas instanceof Array);
        assert(typeof store.getters.defaultJava === 'string');
    })
    it('should be able to add java', async () => {
        await store.dispatch('addJava', 'mcashhihasisf')
        assert(store.getters.javas.indexOf('mcashhihasisf') !== -1)
    })
})

describe('auth', () => {
    it('should switch auth mode', async () => {
        await store.dispatch('auth/selectMode', 'mojang')
        assert.equal(store.getters['auth/mode'], 'mojang')
        await store.dispatch('auth/selectMode', 'offline')
        assert.equal(store.getters['auth/mode'], 'offline')
        await store.dispatch('auth/selectMode', 'illgal')
        assert.equal(store.getters['auth/mode'], 'offline')
    })
    it('should be able to login offline', async () => {
        await store.dispatch('auth/login', { mode: 'offline', account: 'ci010' })
        assert.equal(store.getters['auth/username'], 'ci010');
        assert(typeof store.getters['auth/id'] === 'string');
        assert.equal(store.getters['auth/logined'], true);
    })
    it('should be able to logout', async () => {
        await store.dispatch('auth/logout');
        assert.equal(store.getters['auth/username'], '');
        assert.equal(store.getters['auth/id'], '');
        assert.equal(store.getters['auth/logined'], false);
    })
    it('should cache all history', async () => {
        assert.deepEqual(store.getters['auth/history'], ['ci010']);
        await store.dispatch('auth/login', { mode: 'offline', account: 'cijhn' });
        assert.deepEqual(store.getters['auth/history'], ['cijhn', 'ci010']);
        await store.dispatch('auth/login', { mode: 'offline', account: 'jjj' })
        assert.deepEqual(store.getters['auth/history'], ['jjj', 'cijhn', 'ci010']);
    })
    it('should clear the history', async () => {
        store.dispatch('auth/clearHistory');
        assert.deepEqual(store.getters['auth/history'], []);
    })
})
