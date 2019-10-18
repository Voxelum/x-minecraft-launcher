import { Auth, MojangService, Net, ProfileService, Task, UserType, LibraryInfo, Version, Installer } from '@xmcl/minecraft-launcher-core';
import fileType from 'file-type';
import got from 'got';
import { fs, requireObject, requireString } from 'main/utils';
import { ComparableVersion } from 'maven-artifact-version';
import { basename, join } from 'path';
import base, { UserModule } from 'universal/store/modules/user';
import { parse as parseUrl } from 'url';
import { v4 } from 'uuid';


/**
 * The possible ways for user auth and profile:
 * 
 * 1. By uuid
 * user login, use the the uuid from auth info to fetch game profile and get the skin;
 * this method usually requires the auth service and profile service is the same provider
 * 
 * 2. By username
 * user login, and then use the username from auth info to fetch game profile and get the skin;
 * in this method, user could have different auth and profile services 
 * 
 * Module Requirement:
 * 
 * login, by user name and password
 * 
 * getGameProfile, get profile by user uuid or user name
 * selectGameProfileService, select the profile service 
 * 
 */
const mod: UserModule = {
    ...base,
    actions: {
        async save(context, { mutation }) {
            switch (mutation) {
                case 'addUserProfile':
                case 'setUserProfile':
                case 'updateGameProfile':
                case 'updateUserProfile':
                case 'authService':
                case 'profileService':
                case 'invalidateAuth':
                    await context.dispatch('setPersistence', {
                        path: 'user.json',
                        data: { ...context.state, cape: undefined, info: undefined, security: undefined, refreshingSecurity: undefined, refreshingSkin: undefined },
                    });
                    break;
                default:
            }
        },
        async load(context) {
            const data = await context.dispatch('getPersistence', { path: 'user.json', schema: 'UserConfig' });

            if (typeof data === 'object') {
                const authService = typeof data.authServices === 'object' ? data.authServices : {};
                authService.mojang = Auth.Yggdrasil.API_MOJANG;
                data.authServices = authService;

                const profileServices = typeof data.profileServices === 'object' ? data.profileServices : {};
                profileServices.mojang = ProfileService.API_MOJANG;
                data.profileServices = profileServices;

                delete data.info;
                delete data.refreshingSecurity;
                delete data.refreshingSkin;
                delete data.security;

                if (data.id) { // data fix
                    data.profiles = {
                        [data.userId]: {
                            id: data.userId,
                            type: data.userType,
                            account: '',
                            profileService: data.profileService,
                            authService: data.authService,
                            properties: data.properties,
                            profiles: [{ id: data.id, name: data.name }],
                        },
                    };
                    data.selectedUser = data.userId;
                    data.selectedGameProfile = data.id;
                }
                context.commit('userSnapshot', data);
            } else {
                console.log('Not found local user record, use default setting');
                context.commit('userSnapshot', {
                    authServices: {
                        mojang: Auth.Yggdrasil.API_MOJANG,
                    },
                    profileServices: {
                        mojang: ProfileService.API_MOJANG,
                    },
                    clientToken: v4().replace(/-/g, ''),
                    profiles: {},
                    selectedUser: '',
                    selectedUserProfile: '',
                    loginHistory: [],
                });
            }
        },
        async init(context) {
            context.dispatch('refreshUser');
        },
        /**
         * Logout and clear current cache.
         */
        async logout(context) {
            const user = context.getters.selectedUser;
            if (context.getters.logined) {
                if (user.authService !== 'offline') {
                    await Auth.Yggdrasil.invalide({
                        accessToken: user.accessToken,
                        clientToken: context.state.clientToken,
                    }, context.getters.authService);
                }
            }
            context.commit('invalidateAuth');
        },

        async checkLocation(context) {
            if (!context.getters.logined) return true;
            const user = context.getters.selectedUser;
            if (user.authService !== 'mojang') return true;
            if (context.state.refreshingSecurity) return true;
            context.commit('refreshingSecurity', true);
            try {
                const result = await MojangService.checkLocation(user.accessToken);
                context.commit('userSecurity', result);
                return result;
            } catch (e) {
                if (e.error === 'ForbiddenOperationException' && e.errorMessage === 'Current IP is not secured') {
                    context.commit('userSecurity', false);
                    return false;
                }
                throw e;
            } finally {
                context.commit('refreshingSecurity', false);
            }
        },

        async getChallenges(context) {
            if (!context.getters.logined) return [];
            const user = context.getters.selectedUser;
            if (user.profileService !== 'mojang') return [];
            return MojangService.getChallenges(user.accessToken);
        },

        async submitChallenges(context, responses) {
            if (!context.getters.logined) throw new Error('Cannot submit challenge if not logined');
            const user = context.getters.selectedUser;
            if (user.authService !== 'mojang') throw new Error('Cannot sumit challenge if login mode is not mojang!');
            if (!(responses instanceof Array)) throw new Error('Expect responses Array!');
            const result = await MojangService.responseChallenges(user.accessToken, responses);
            context.commit('userSecurity', true);
            return result;
        },

        async refreshSkin(context) {
            const user = context.getters.selectedUser;
            const gameProfile = context.getters.selectedGameProfile;
            if (user.profileService === '') return;
            if (gameProfile.name === '') return;
            if (!context.getters.logined) return;
            if (context.state.refreshingSkin) return;

            context.commit('refreshingSkin', true);

            const { id, name } = gameProfile;

            try {
                let profile;
                if (context.getters.isServiceCompatible) {
                    profile = await ProfileService.fetch(id, { api: context.getters.profileService });
                } else {
                    profile = await ProfileService.lookup(name, { api: context.getters.profileService });
                    profile = await ProfileService.fetch(profile.id, { api: context.getters.profileService });
                }
                const textures = await ProfileService.getTextures(profile, false);
                const skin = textures.textures.SKIN;

                if (textures && skin) {
                    context.commit('updateGameProfile', { userId: user.id, profile: { ...gameProfile, textures: { ...textures.textures, SKIN: skin } } });
                }
            } catch (e) {
                console.warn(`Cannot refresh the skin data for user ${name}(${id}).`);
                console.warn(e);
                throw e;
            } finally {
                context.commit('refreshingSkin', false);
            }
        },

        async refreshInfo(context) {
            const user = context.getters.selectedUser;

            if (!context.getters.offline) {
                const validate = await Auth.Yggdrasil.validate({
                    accessToken: user.accessToken,
                    clientToken: context.state.clientToken,
                }, context.getters.authService).catch(e => false);

                if (validate) {
                    context.dispatch('checkLocation');
                    return;
                }
                try {
                    const result = await Auth.Yggdrasil.refresh({
                        accessToken: user.accessToken,
                        clientToken: context.state.clientToken,
                    });
                    context.commit('updateUserProfile', result);
                    context.dispatch('checkLocation');

                    if (user.authService === 'mojang') {
                        try {
                            const info = await MojangService.getAccountInfo(user.accessToken);
                            context.commit('mojangInfo', info);
                        } catch (e) {
                            console.warn(`Cannot refresh mojang info for user ${user.account}.`);
                            console.warn(e);
                        }
                    }
                } catch (e) {
                    context.commit('invalidateAuth');
                }
            }
        },


        async uploadSkin(context, payload) {
            requireObject(payload);
            requireString(payload.data);

            const user = context.getters.selectedUser;
            const gameProfile = context.getters.selectedGameProfile;

            if (typeof payload.slim !== 'boolean') payload.slim = false;

            const { data, slim } = payload;
            let uri;
            if (typeof data === 'string') {
                uri = Buffer.from(data, 'base64');
            } else if (data instanceof Buffer) {
                uri = data;
            } else {
                throw new Error('Illegal Skin data format! Require a Buffer');
            }
            const accessToken = user.accessToken;
            const uuid = gameProfile.id;
            return ProfileService.setTexture({
                uuid,
                accessToken,
                type: 'skin',
                texture: {
                    metadata: {
                        model: slim ? 'slim' : 'steve',
                    },
                    url: '',
                },
                data: uri,
            }, context.getters.profileService).catch((e) => {
                console.error(e);
                throw e;
            });
        },
        async saveSkin(context, { skin, path }) {
            requireObject(skin);
            requireString(skin.data);
            requireString(path);
            return fs.writeFile(path, Buffer.from(skin.data, 'base64'));
        },
        async parseSkin(context, path) {
            requireString(path);

            const url = parseUrl(path);

            let buf;
            switch (url.protocol) {
                case 'http:':
                case 'https:':
                    buf = await got.get(path, { encoding: null }).then(r => r.body);
                    break;
                default:
                    buf = await fs.readFile(path);
            }
            const type = fileType(buf);
            if (type && type.ext === 'png') {
                return buf.toString('base64');
            }
            throw new Error('Illegal File Type')
        },
        /**
         * Refresh the current user login status
         */
        async refreshUser(context) {
            if (!context.getters.logined) return;
            context.dispatch('refreshInfo').catch(_ => _);
            context.dispatch('refreshSkin').catch(_ => _);
        },

        async switchUserProfile({ commit, dispatch }, payload) {
            commit('setUserProfile', payload);
            await dispatch('refreshUser');
        },

        /**
         * Login the user by current login mode. Refresh the skin and account information.
         */
        async login(context, payload) {
            if (!payload) throw new Error();
            requireObject(payload);
            requireString(payload.account);

            const selectedUserProfile = context.getters.selectedUser;

            const { account, password } = payload;
            const {
                authService = password ? 'mojang' : 'offline',
                profileService = 'mojang',
            } = payload;

            const usingAuthService = context.state.authServices[authService];

            try {
                const result: Auth = authService === 'offline'
                    ? Auth.offline(account)
                    : await Auth.Yggdrasil.login({
                        username: account,
                        password,
                        clientToken: context.state.clientToken,
                    }, usingAuthService).catch((e) => {
                        if (e.message && e.message.startsWith('getaddrinfo ENOTFOUND')) {
                            const err = { message: 'error.internetNotConnected' };
                            throw err;
                        }
                        throw e;
                    });

                if (authService !== selectedUserProfile.authService
                    || profileService !== selectedUserProfile.profileService
                    || (authService === 'offline' && account !== selectedUserProfile.account)) {
                    context.commit('addUserProfile', {
                        account,
                        authService,
                        profileService,
                        id: result.userId,
                        type: result.userType,
                        accessToken: result.accessToken,
                        profiles: result.profiles.map(p => ({ ...p, textures: { SKIN: { url: '' } } })),
                    });

                    context.commit('setUserProfile', {
                        profileId: result.selectedProfile.id,
                        userId: result.userId,
                    });
                } else {
                    context.commit('updateUserProfile', result);
                }
                await context.dispatch('refreshSkin').catch(_ => _);
                await context.dispatch('refreshInfo').catch(_ => _);
            } catch (e) {
                console.error('Error during login.');
                console.error(e);
                throw e;
            }
        },
    },
};

export default mod;
