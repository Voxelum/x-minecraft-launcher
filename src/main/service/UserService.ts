import { Auth, MojangChallengeResponse, MojangService, Net, ProfileService } from '@xmcl/minecraft-launcher-core';
import { fs, requireNonnull, requireObject, requireString } from 'main/utils';
import { getPersistence, setPersistence } from 'main/utils/persistence';
import { MutationKeys } from 'universal/store';
import { UserSchema } from 'universal/store/modules/user.schema';
import { parse } from 'url';
import { v4 } from 'uuid';
import Service, { Singleton } from './Service';

interface LauncherProfile {
    /**
     * All the launcher profiles and their configurations.
     */
    profiles: {
        [name: string]: {
            name: string;
            /**
             * The profile type. 
             * Types are custom (manually created by the user), 
             * latest-release (uses the latest stable release), 
             * and latest-snapshot (uses the latest build of Minecraft).
             */
            type: string;
            gameDir: string;
            javaDir: string;
            javaArgs: string;
            /**
             * The version ID that the profile targets. Version IDs are determined in the version.json in every directory in ~/versions
             */
            lastVersionId: string;
            /**
             * An Base64-encoded image which represents the icon of the profile in the profiles menu.
             */
            icon: string;
            created: string;
            /**
             * An ISO 8601 formatted date which represents the last time the profile was used.
             */
            lastUsed: string;
        };
    };
    clientToken: string;
    /**
     * All the logged in accounts. 
     * Every account in this key contains a UUID-hashed map (which is used to save the selected user) 
     * which in turn includes the access token, e-mail, and a profile (which contains the account display name)
     */
    authenticationDatabase: {
        [uuid: string]: {
            accessToken: string;
            username: string;
            profiles: {
                [uuid: string]: {
                    displayName: string;
                };
            };
            properties: object[];
        };
    };
    settings: {};
    /**
     * Contains the UUID-hashed account and the UUID of the currently selected user
     */
    selectedUser: {
        /**
         * The UUID-hashed key of the currently selected account
         */
        account: string;
        /**
         * The UUID of the currently selected player
         */
        profile: string;
    };
}

export default class UserService extends Service {
    async save({ mutation }: { mutation: MutationKeys }) {
        switch (mutation) {
            case 'userProfileAdd':
            case 'userProfileRemove':
            case 'userProfileUpdate':
            case 'userGameProfileSelect':
            case 'authService':
            case 'profileService':
            case 'userInvalidate':
            case 'authServiceRemove':
            case 'profileServiceRemove':
                await setPersistence({
                    path: this.getPath('user.json'),
                    data: { ...this.state.user },
                    schema: UserSchema,
                });
                break;
            default:
        }
    }

    async getMinecraftAuthDb() {
        const data: LauncherProfile = await fs.readFile(this.getMinecraftPath('launcher_profile.json')).then(b => JSON.parse(b.toString()), () => { });
        return data;
    }

    async load() {
        const data = await getPersistence({ path: this.getPath('user.json'), schema: UserSchema });
        const result: UserSchema = {
            authServices: {},
            profileServices: {},
            users: {},
            selectedUser: {
                id: '',
                profile: '',
            },
            clientToken: '',
        };
        const mcdb = await this.getMinecraftAuthDb();
        if (typeof data === 'object') {
            result.authServices = data.authServices;
            result.authServices.mojang = Auth.Yggdrasil.API_MOJANG;

            result.profileServices = data.profileServices;
            result.profileServices.mojang = ProfileService.API_MOJANG;

            if (data.clientToken) {
                result.clientToken = data.clientToken;
            } else {
                result.clientToken = mcdb?.clientToken ?? v4().replace(/-/g, '');
            }

            result.selectedUser = data.selectedUser;
            result.users = data.users;
        } else {
            // import mojang authDB

            result.clientToken = mcdb?.clientToken ?? v4().replace(/-/g, '');
            result.authServices = { mojang: Auth.Yggdrasil.API_MOJANG };
            result.profileServices = { mojang: ProfileService.API_MOJANG };

            if (mcdb.selectedUser) {
                result.selectedUser.id = mcdb.selectedUser.account;
                result.selectedUser.profile = mcdb.selectedUser.profile;
            }
        }
        if (mcdb?.clientToken === result.clientToken && mcdb.authenticationDatabase) {
            const adb = mcdb.authenticationDatabase;
            for (const userId of Object.keys(adb)) {
                const user = adb[userId];
                if (!result.users[userId]) {
                    result.users[userId] = {
                        id: userId,
                        username: user.username,
                        accessToken: user.accessToken,
                        authService: 'mojang',
                        profileService: 'mojang',
                        profiles: Object.entries(user.profiles)
                            .reduce((dict, [id, o]) => {
                                dict[id] = {
                                    id,
                                    name: o.displayName,
                                    textures: { SKIN: { url: '' } },
                                };
                                return dict;
                            }, {} as { [key: string]: any }),
                    };
                }
            }
        }
        this.commit('userSnapshot', data);
    }

    async init() {
        this.refreshUser();
    }

    /**
     * Logout and clear current cache.
     */
    async logout() {
        const user = this.getters.user;
        if (this.getters.accessTokenValid) {
            if (user.authService !== 'offline') {
                await Auth.Yggdrasil.invalidate({
                    accessToken: user.accessToken,
                    clientToken: this.state.user.clientToken,
                }, this.getters.authService);
            }
        }
        this.commit('userInvalidate');
    }

    /**
     * Check current ip location and determine wether we need to validate user identity by response challenge.
     * 
     * See `getChallenges` and `submitChallenges`
     */
    @Singleton()
    async checkLocation() {
        if (!this.getters.accessTokenValid) return true;
        const user = this.getters.user;
        if (user.authService !== 'mojang') return true;
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
        }
    }

    /**
     * Get all the user set challenges for security reasons.
     */
    async getChallenges() {
        if (!this.getters.accessTokenValid) return [];
        const user = this.getters.user;
        if (user.profileService !== 'mojang') return [];
        return MojangService.getChallenges(user.accessToken);
    }

    async submitChallenges(responses: MojangChallengeResponse[]) {
        if (!this.getters.accessTokenValid) throw new Error('Cannot submit challenge if not logined');
        const user = this.getters.user;
        if (user.authService !== 'mojang') throw new Error('Cannot sumit challenge if login mode is not mojang!');
        if (!(responses instanceof Array)) throw new Error('Expect responses Array!');
        const result = await MojangService.responseChallenges(user.accessToken, responses);
        this.commit('userSecurity', true);
        return result;
    }

    /**
     * Refresh current skin status
     */
    @Singleton()
    async refreshSkin() {
        const user = this.getters.user;
        const gameProfile = this.getters.gameProfile;
        // if no profile service, return
        if (user.profileService === '') return;
        // if no game profile (maybe not logined), return
        if (gameProfile.name === '') return;
        // if user doesn't have a valid access token, return
        if (!this.getters.accessTokenValid) return;

        const { id, name } = gameProfile;

        try {
            let profile;
            if (this.getters.isServiceCompatible) {
                profile = await ProfileService.fetch(id, { api: this.getters.profileService });
            } else {
                // use name to look up
                profile = await ProfileService.lookup(name, { api: this.getters.profileService });
                if (!profile) {
                    throw new Error(`Profile not found named ${name}!`);
                }
                profile = await ProfileService.fetch(profile.id, { api: this.getters.profileService });
            }
            const textures = ProfileService.getTextures(profile);
            const skin = textures?.textures.SKIN;
            if (skin) {
                this.commit('gameProfile', {
                    userId: user.id,
                    profile: {
                        ...gameProfile,
                        textures: { ...(textures?.textures || {}), SKIN: skin },
                    },
                });
            }
        } catch (e) {
            console.warn(`Cannot refresh the skin data for user ${name}(${id}).`);
            console.warn(e);
            throw e;
        }
    }

    /**
     * Refresh the user auth status
     */
    async refreshStatus() {
        const user = this.getters.user;

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
                this.commit('userProfileUpdate', {
                    id: result.user.id,
                    accessToken: result.accessToken,
                    profiles: result.availableProfiles,
                });
                this.checkLocation();

                if (user.authService === 'mojang') {
                    try {
                        const info = await MojangService.getAccountInfo(user.accessToken);
                        this.commit('userMojangInfo', info);
                    } catch (e) {
                        console.warn(`Cannot refresh mojang info for user ${user.username}.`);
                        console.warn(e);
                    }
                }
            } catch (e) {
                this.commit('userInvalidate');
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

        const user = this.getters.user;
        const gameProfile = this.getters.gameProfile;

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
        if (!this.getters.accessTokenValid) return;
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

        this.commit('userGameProfileSelect', payload);
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


        const selectedUserProfile = this.getters.user;
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
                || (authService === 'offline' && account !== selectedUserProfile.username)) {
                this.commit('userProfileAdd', {
                    id: result.user.id,
                    username: account,
                    profileService,
                    authService,
                    accessToken: result.accessToken,
                    profiles: result.availableProfiles,
                });
                this.commit('userGameProfileSelect', {
                    profileId: result.selectedProfile.id,
                    userId: result.user.id,
                });
            } else {
                this.commit('userProfileUpdate', {
                    id: result.user.id,
                    accessToken: result.accessToken,
                    profiles: result.availableProfiles,
                });
            }
            await this.refreshSkin().catch(_ => _);
        } catch (e) {
            console.error('Error during login.');
            console.error(e);
            throw e;
        }
    }
}
