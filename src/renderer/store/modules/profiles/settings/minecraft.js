import { GameSetting, WorldInfo } from 'ts-minecraft'
import Vue from 'vue'
import fs from 'fs-extra'
import paths from 'path'
import Zip from 'jszip'

export default {
    namespaced: true,
    state: () => ({
        name: 'custom',
        version: '',
        maps: [],
        settings: {
            version: 1139, // for 1.12
            invertYMouse: false,
            mouseSensitivity: 0.5,
            difficulty: 2,

            // critical performance video settings 
            renderDistance: 12,
            particles: 0,
            fboEnable: true,
            fancyGraphics: true,
            ao: 2,
            renderClouds: true,
            enableVsync: true,
            useVbo: true,
            mipmapLevels: 4,
            anaglyph3d: false,

            fov: 0,
            gamma: 0,
            saturation: 0,
            guiScale: 0,
            bobView: true,
            maxFps: 120,
            fullscreen: false,

            resourcePacks: [],
            incompatibleResourcePacks: [],
            lastServer: '',
            lang: 'en_us',
            chatVisibility: 0,
            chatColors: true,
            chatLinks: true,
            chatLinksPrompt: true,
            chatOpacity: 1,
            snooperEnabled: true,

            hideServerAddress: false,
            advancedItemTooltips: false,
            pauseOnLostFocus: true,
            touchscreen: false,
            overrideWidth: 0,
            overrideHeight: 0,
            heldItemTooltips: true,
            chatHeightFocused: 1,
            chatHeightUnfocused: 0.44366196,
            chatScale: 1,
            chatWidth: 1,
            forceUnicodeFont: false,
            reducedDebugInfo: false,
            useNativeTransport: true,
            entityShadows: true,
            mainHand: 'right',
            attackIndicator: 1,
            showSubtitles: false,
            realmsNotifications: true,
            enableWeakAttacks: false,
            autoJump: true,
            narrator: 0,
            tutorialStep: 'movement',
            'key_key.attack': -100,
            'key_key.use': -99,
            'key_key.forward': 17,
            'key_key.left': 30,
            'key_key.back': 31,
            'key_key.right': 32,
            'key_key.jump': 57,
            'key_key.sneak': 42,
            'key_key.sprint': 29,
            'key_key.drop': 16,
            'key_key.inventory': 18,
            'key_key.chat': 20,
            'key_key.playerlist': 15,
            'key_key.pickItem': -98,
            'key_key.command': 53,
            'key_key.screenshot': 60,
            'key_key.togglePerspective': 63,
            'key_key.smoothCamera': 0,
            'key_key.fullscreen': 87,
            'key_key.spectatorOutlines': 0,
            'key_key.swapHands': 33,
            'key_key.saveToolbarActivator': 46,
            'key_key.loadToolbarActivator': 45,
            'key_key.advancements': 38,
            'key_key.hotbar.1': 2,
            'key_key.hotbar.2': 3,
            'key_key.hotbar.3': 4,
            'key_key.hotbar.4': 5,
            'key_key.hotbar.5': 6,
            'key_key.hotbar.6': 7,
            'key_key.hotbar.7': 8,
            'key_key.hotbar.8': 9,
            'key_key.hotbar.9': 10,
            soundCategory_master: 1,
            soundCategory_music: 1,
            soundCategory_record: 1,
            soundCategory_weather: 1,
            soundCategory_block: 1,
            soundCategory_hostile: 1,
            soundCategory_neutral: 1,
            soundCategory_player: 1,
            soundCategory_ambient: 1,
            soundCategory_voice: 1,
            modelPart_cape: true,
            modelPart_jacket: true,
            modelPart_left_sleeve: true,
            modelPart_right_sleeve: true,
            modelPart_left_pants_leg: true,
            modelPart_right_pants_leg: true,
            modelPart_hat: true,
        },
    }),
    getters: {
        options: states => states.settings,
        resourcepacks: states => states.settings.resourcePacks,
        version: states => states.version,
        maps: state => state.maps,
        name: states => states.name,
    },
    mutations: {
        version(states, version) {
            states.version = version
        },
        update(states, { key, value }) {
            states.settings[key] = value
        },
        update$reload(states, data) {
            const { maps, name, version, settings } = data;
            // states.name = name;
            // states.version = version;
            for (const key in settings) {
                if (settings[key] !== undefined
                    && settings[key] != null
                    && states.settings[key] !== undefined) {
                    states.settings[key] = settings[key]
                }
            }
            for (const map of maps) states.maps.push(map)
        },
        /**
         * 
         * @param {any} states 
         * @param {{action:ResourcePackActions, pack:string}} payload 
         */
        resourcepack(states, payload) {
            const { action, pack } = payload;
            let idx;
            let temp;
            switch (action) {
                case 'add':
                    if (states.settings.resourcePacks.indexOf(pack) === -1) {
                        states.settings.resourcePacks.push(pack)
                    }
                    break;
                case 'remove':
                    states.settings.resourcePacks = states.settings.resourcePacks
                        .filter(name => name !== pack);
                    break;
                case 'moveup':
                    idx = states.settings.resourcePacks.indexOf(pack)
                    if (idx <= 0) return;
                    temp = states.settings.resourcePacks[idx - 1];
                    Vue.set(states.settings.resourcePacks, idx - 1, pack)
                    Vue.set(states.settings.resourcePacks, idx, temp)
                    break;
                case 'movedown':
                    idx = states.settings.resourcePacks.indexOf(pack)
                    if (idx === -1 || idx === states.settings.resourcePacks.length - 1) return;
                    temp = states.settings.resourcePacks[idx + 1];
                    Vue.set(states.settings.resourcePacks, idx + 1, pack)
                    Vue.set(states.settings.resourcePacks, idx, temp)
                    break;
                default: break;
            }
        },
        updateTemplate(states, { name, template }) {
            states.name = name;
            states.settings = template;
        },

    },
    actions: {
        save(context, { id }) {
            const path = `profiles/${id}/options.txt`
            const data = GameSetting.stringify(context.state.settings)
            return context.dispatch('write', { path, data }, { root: true })
        },
        async load(context, { id }) {
            const gcString = await context.dispatch('read', {
                path: `profiles/${id}/options.txt`,
                fallback: {},
                encoding: 'string',
            }, { root: true });
            const settings = typeof gcString === 'string' ? GameSetting.parse(gcString) : gcString;

            const readMap = async (file) => {
                const exist = await context.dispatch('exist', {
                    paths: [`profiles/${id}/saves/${file}/level.dat`],
                }, { root: true })
                if (!exist) return undefined;
                const levBuf = await context.dispatch('read', {
                    path: `profiles/${id}/saves/${file}/level.dat`,
                    fallback: undefined,
                }, { root: true });
                if (levBuf === undefined) return undefined;
                const imgBuf = await context.dispatch('read', {
                    path: `profiles/${id}/saves/${file}/icon.png`,
                    fallback: undefined,
                }, { root: true })
                const info = WorldInfo.parse(levBuf);
                if (imgBuf) info.icon = `data:image/png;base64, ${imgBuf.toString('base64')}`;
                return info
            }
            let maps;
            try {
                const files = (await context.dispatch('readFolder', { path: `profiles/${id}/saves` }, { root: true }))
                maps = (await Promise.all(files.map(readMap))).filter(m => m !== undefined);
            } catch (e) {
                console.warn(e)
            }

            return {
                settings,
                maps,
            }
        },
        importMap(context, { id, location }) {
            return WorldInfo.valid(location);
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{id:string, map:string, targetFolder: string, zip:string}} payload
         */
        exportMap(context, { id, map, targetFolder, zip }) {
            return context.dispatch('query', {
                service: 'repository',
                action: 'export',
                payload: {
                    root: context.rootGetters.path(`profiles/${id}/saves/${map}`),
                    resource: {

                    },
                    targetDirectory: targetFolder,
                },
            }, { root: true })
        },
        deleteMap(context, { id, map }) {

        },
        useTemplate(context, { templateId }) {

        },
    },
}
