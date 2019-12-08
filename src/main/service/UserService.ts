import { Auth, MojangChallengeResponse, MojangService, Net, ProfileService } from '@xmcl/minecraft-launcher-core';
import { fs, requireNonnull, requireObject, requireString } from 'main/utils';
import { getPersistence, setPersistence } from 'main/utils/persistence';
import UserConfig from 'main/utils/schema/UserConfig.json';
import { parse } from 'url';
import { v4 } from 'uuid';
import Service from './Service';

export default class UserService extends Service {
    async save({ mutation }: { mutation: string }) {
        switch (mutation) {
            case 'addUserProfile':
            case 'setUserProfile':
            case 'updateGameProfile':
            case 'updateUserProfile':
            case 'authService':
            case 'profileService':
            case 'invalidateAuth':
                await setPersistence({
                    path: this.getPath('user.json'),
                    data: { ...this.state.user, cape: undefined, info: undefined, security: undefined, refreshingSecurity: undefined, refreshingSkin: undefined },
                });
                break;
            default:
        }
    }

    async load() {
        const data = await getPersistence({ path: this.getPath('user.json'), schema: UserConfig });

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
            this.commit('userSnapshot', data);
        } else {
            console.log('Not found local user record, use default setting');
            this.commit('userSnapshot', {
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
    }

    async init() {
        this.refreshUser();
    }

    /**
     * Logout and clear current cache.
     */
    async logout() {
        const user = this.getters.selectedUser;
        if (this.getters.logined) {
            if (user.authService !== 'offline') {
                await Auth.Yggdrasil.invalidate({
                    accessToken: user.accessToken,
                    clientToken: this.state.user.clientToken,
                }, this.getters.authService);
            }
        }
        this.commit('invalidateAuth');
    }

    /**
     * Check current ip location and determine wether we need to validate user identity by response challenge.
     * 
     * See `getChallenges` and `submitChallenges`
     */
    async checkLocation() {
        if (!this.getters.logined) return true;
        const user = this.getters.selectedUser;
        if (user.authService !== 'mojang') return true;
        if (this.state.user.refreshingSecurity) return true;
        this.commit('refreshingSecurity', true);
        try {
            const result = await MojangService.checkLocation(user.accessToken);
            this.commit('userSecurity', result);
            return result;
        } catch (e) {
            if (e.error === 'ForbiddenOperationException' && e.errorMessage === 'Current IP is not secured') {
                this.commit('userSecurity', false);
                return false;
            }
            throw e;
        } finally {
            this.commit('refreshingSecurity', false);
        }
    }

    /**
     * Get all the user set challenges for security reasons.
     */
    async getChallenges() {
        if (!this.getters.logined) return [];
        const user = this.getters.selectedUser;
        if (user.profileService !== 'mojang') return [];
        return MojangService.getChallenges(user.accessToken);
    }

    async submitChallenges(responses: MojangChallengeResponse[]) {
        if (!this.getters.logined) throw new Error('Cannot submit challenge if not logined');
        const user = this.getters.selectedUser;
        if (user.authService !== 'mojang') throw new Error('Cannot sumit challenge if login mode is not mojang!');
        if (!(responses instanceof Array)) throw new Error('Expect responses Array!');
        const result = await MojangService.responseChallenges(user.accessToken, responses);
        this.commit('userSecurity', true);
        return result;
    }

    /**
     * Refresh current skin status
     */
    async refreshSkin() {
        const user = this.getters.selectedUser;
        const gameProfile = this.getters.selectedGameProfile;
        if (user.profileService === '') return;
        if (gameProfile.name === '') return;
        if (!this.getters.logined) return;
        if (this.state.user.refreshingSkin) return;

        this.commit('refreshingSkin', true);

        const { id, name } = gameProfile;

        try {
            let profile;
            if (this.getters.isServiceCompatible) {
                profile = await ProfileService.fetch(id, { api: this.getters.profileService });
            } else {
                profile = await ProfileService.lookup(name, { api: this.getters.profileService });
                if (!profile) {
                    throw new Error(`Profile not found named ${name}!`);
                }
                profile = await ProfileService.fetch(profile.id, { api: this.getters.profileService });
            }
            const textures = await ProfileService.getTextures(profile);
            if (textures) {
                const skin = textures.textures.SKIN;
                if (skin) {
                    this.commit('updateGameProfile', { userId: user.id, profile: { ...gameProfile, textures: { ...textures.textures, SKIN: skin } } });
                }
            }
        } catch (e) {
            console.warn(`Cannot refresh the skin data for user ${name}(${id}).`);
            console.warn(e);
            throw e;
        } finally {
            this.commit('refreshingSkin', false);
        }
    }

    /**
     * Refresh the user auth status
     */
    async refreshStatus() {
        const user = this.getters.selectedUser;

        if (!this.getters.offline) {
            const validate = await Auth.Yggdrasil.validate({
                accessToken: user.accessToken,
                clientToken: this.state.user.clientToken,
            }, this.getters.authService).catch(() => false);

            if (validate) {
                this.checkLocation();
                return;
            }
            try {
                const result = await Auth.Yggdrasil.refresh({
                    accessToken: user.accessToken,
                    clientToken: this.state.user.clientToken,
                });
                this.commit('updateUserProfile', result);
                this.checkLocation();

                if (user.authService === 'mojang') {
                    try {
                        const info = await MojangService.getAccountInfo(user.accessToken);
                        this.commit('mojangInfo', info);
                    } catch (e) {
                        console.warn(`Cannot refresh mojang info for user ${user.account}.`);
                        console.warn(e);
                    }
                }
            } catch (e) {
                this.commit('invalidateAuth');
            }
        }
    }

    /**
     * Upload the skin to server
     * @param payload 
     */
    async uploadSkin(payload: { url: string; slim: boolean }) {
        requireObject(payload);
        requireNonnull(payload.url);

        const user = this.getters.selectedUser;
        const gameProfile = this.getters.selectedGameProfile;

        if (typeof payload.slim !== 'boolean') payload.slim = false;
        const { url, slim } = payload;

        const parsedUrl = parse(url);
        let data: Buffer | undefined;
        let urlString = '';
        if (parsedUrl.protocol === 'file:') {
            data = await fs.readFile(url);
        } else if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
            urlString = url;
        } else {
            throw new Error('Unknown url protocol! Require a file or http/https protocol!');
        }
        return ProfileService.setTexture({
            uuid: gameProfile.id,
            accessToken: user.accessToken,
            type: 'skin',
            texture: {
                metadata: {
                    model: slim ? 'slim' : 'steve',
                },
                url: urlString,
            },
            data,
        }, this.getters.profileService).catch((e) => {
            console.error(e);
            throw e;
        });
    }

    /**
     * Save the skin to the disk
     */
    async saveSkin(option: { url: string; path: string }) {
        requireObject(option);
        requireString(option.url);
        requireString(option.path);
        const { path, url } = option;
        return fs.writeFile(path, await Net.downloadBuffer({ url }));
    }

    /**
     * Refresh the current user login status
     */
    async refreshUser() {
        if (!this.getters.logined) return;
        await this.refreshSkin().catch(_ => _);
        await this.refreshStatus().catch(_ => _);
    }

    /**
    * Switch user account.
    */
    async switchUserProfile(payload: {
        /**
         * The user id of the user
         */
        userId: string;
        /**
         * The game profile id of the user
         */
        profileId: string;
    }) {
        requireObject(payload);
        requireString(payload.userId);
        requireString(payload.profileId);

        this.commit('setUserProfile', payload);
        await this.refreshUser();
    }

    /**
     * Login the user by current login mode. Refresh the skin and account information.
     */
    async login(payload: {
        /**
         * The user account. Can be email or other thing the auth service want.
         */
        account: string;
        /**
         * The password. Maybe empty string.
         */
        password?: string;
        /**
         * The auth service name, like mojang.
         */
        authService?: string;
        /**
         * The profile serivce name, like mojang
         */
        profileService?: string;
    }) {
        if (!payload) throw new Error();
        requireObject(payload);
        requireString(payload.account);

        const {
            account,
            password,
            authService = password ? 'mojang' : 'offline',
            profileService = 'mojang',
        } = payload;


        const selectedUserProfile = this.getters.selectedUser;
        const usingAuthService = this.state.user.authServices[authService];

        try {
            const result = authService === 'offline'
                ? Auth.offline(account)
                : await Auth.Yggdrasil.login({
                    username: account,
                    password: password || '',
                    requestUser: true,
                    clientToken: this.state.user.clientToken,
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
                this.commit('addUserProfile', {
                    account,
                    authService,
                    profileService,
                    id: result.user.id,
                    type: 'Mojang',
                    accessToken: result.accessToken,
                    profiles: result.availableProfiles.map(p => ({ ...p, textures: { SKIN: { url: '' } } })),
                });
                this.commit('setUserProfile', {
                    profileId: result.selectedProfile.id,
                    userId: result.user.id,
                });
            } else {
                this.commit('updateUserProfile', result as any);
            }
            await this.refreshSkin().catch(_ => _);
        } catch (e) {
            console.error('Error during login.');
            console.error(e);
            throw e;
        }
    }
}
