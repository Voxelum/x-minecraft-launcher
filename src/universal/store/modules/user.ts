import { Auth, MojangAccount, ProfileService } from '@xmcl/minecraft-launcher-core';
import { GameProfile } from '@xmcl/profile-service';
import { fitin } from 'universal/utils/object';
import Vue from 'vue';
import { ModuleOption } from '../root';
import { GameProfileAndTexture, UserProfile, UserSchema } from './user.schema';

export type UserGameProfile = Omit<UserProfile, 'profiles'> & GameProfileAndTexture & { userId: string; id: string };

interface State extends UserSchema {
    /**
     * The mojang user info
     */
    mojangInfo: MojangAccount | null;
    /**
     * If this is true, user can get the skin data from mojang, else user has to answer the challenge to continue.
     */
    mojangSecurity: boolean;
}

interface Getters {
    /**
     * Current selected user profile
     */
    user: UserProfile;
    /**
     * Current selected user's game profile
     */
    gameProfile: GameProfileAndTexture;

    /**
     * All avaiable game profiles for user
     */
    gameProfiles: UserGameProfile[];

    /**
     * Does user access token existed or valid? Does user logined? This include the case that user logins as offline mode.
     */
    accessTokenValid: boolean;
    /**
     * If current mode is offline mode
     */
    offline: boolean;
    /**
     * Is the auth service & profile service are the same
     */
    isServiceCompatible: boolean;

    authServices: string[]; // TODO: remove
    profileServices: string[]; // TODO: remove

    authService: Auth.Yggdrasil.API;
    profileService: ProfileService.API;
}
interface Mutations {
    userSnapshot: UserSchema;

    userInvalidate: void;

    gameProfile: { userId: string; profile: (GameProfileAndTexture | GameProfile) };
    userProfileAdd: Omit<UserProfile, 'profiles'> & { id: string; profiles: (GameProfileAndTexture | GameProfile)[] };
    userProfileUpdate: { id: string; accessToken: string; profiles: (GameProfileAndTexture | GameProfile)[] };
    userProfileRemove: string;

    userGameProfileSelect: { userId: string; profileId: string };

    authService: { name: string; api: Auth.Yggdrasil.API };
    authServiceRemove: string;
    profileService: { name: string; api: ProfileService.API };
    profileServiceRemove: string;

    userMojangInfo: MojangAccount;
    userSecurity: boolean;
}

export type UserModule = ModuleOption<State, Getters, Mutations, {}>;

const mod: UserModule = {
    state: {
        // user data
        users: {},
        selectedUser: {
            id: '',
            profile: '',
        },

        clientToken: '',

        mojangInfo: null,

        // client data
        authServices: {
            mojang: {
                hostName: 'https://authserver.mojang.com',
                authenticate: '/authenticate',
                refresh: '/refresh',
                validate: '/validate',
                invalidate: '/invalidate',
                signout: '/signout',
            },
        },
        profileServices: {
            mojang: {
                publicKey: `-----BEGIN PUBLIC KEY-----
                MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAylB4B6m5lz7jwrcFz6Fd
                /fnfUhcvlxsTSn5kIK/2aGG1C3kMy4VjhwlxF6BFUSnfxhNswPjh3ZitkBxEAFY2
                5uzkJFRwHwVA9mdwjashXILtR6OqdLXXFVyUPIURLOSWqGNBtb08EN5fMnG8iFLg
                EJIBMxs9BvF3s3/FhuHyPKiVTZmXY0WY4ZyYqvoKR+XjaTRPPvBsDa4WI2u1zxXM
                eHlodT3lnCzVvyOYBLXL6CJgByuOxccJ8hnXfF9yY4F0aeL080Jz/3+EBNG8RO4B
                yhtBf4Ny8NQ6stWsjfeUIvH7bU/4zCYcYOq4WrInXHqS8qruDmIl7P5XXGcabuzQ
                stPf/h2CRAUpP/PlHXcMlvewjmGU6MfDK+lifScNYwjPxRo4nKTGFZf/0aqHCh/E
                AsQyLKrOIYRE0lDG3bzBh8ogIMLAugsAfBb6M3mqCqKaTMAf/VAjh5FFJnjS+7bE
                +bZEV0qwax1CEoPPJL1fIQjOS8zj086gjpGRCtSy9+bTPTfTR/SJ+VUB5G2IeCIt
                kNHpJX2ygojFZ9n5Fnj7R9ZnOM+L8nyIjPu3aePvtcrXlyLhH/hvOfIOjPxOlqW+
                O5QwSFP4OEcyLAUgDdUgyW36Z5mB285uKW/ighzZsOTevVUG2QwDItObIV6i8RCx
                FbN2oDHyPaO5j1tTaBNyVt8CAwEAAQ==
                -----END PUBLIC KEY-----`,
                // eslint-disable-next-line no-template-curly-in-string
                texture: 'https://api.mojang.com/user/profile/${uuid}/${type}',
                // eslint-disable-next-line no-template-curly-in-string
                profile: 'https://sessionserver.mojang.com/session/minecraft/profile/${uuid}',
                // eslint-disable-next-line no-template-curly-in-string
                profileByName: 'https://api.mojang.com/users/profiles/minecraft/${name}',
            },
        },
        mojangSecurity: false,
    },
    getters: {
        gameProfiles: state => Object.entries(state.users)
            .map(([userId, user]) => Object.values(user.profiles)
                .map((profile) => ({ ...profile, userId, authService: user.authService, profileService: user.profileService, username: user.username, accessToken: user.accessToken })))
            .reduce((a, b) => [...a, ...b], []),
        user: state => state.users[state.selectedUser.id]
            || { username: '', profileService: '', authService: '', accessToken: '', profiles: [], properties: {} },
        gameProfile: (state, getters) => getters.user.profiles[state.selectedUser.profile]
            || { id: '', name: '', textures: { SKIN: { url: '' } } },

        accessTokenValid: (_, getters) => getters.user.accessToken !== '',
        offline: (_, getters) => getters.user.authService === 'offline',

        authServices: state => ['offline', ...Object.keys(state.authServices)],
        profileServices: state => Object.keys(state.profileServices),

        isServiceCompatible: (_, getters) => getters.user.authService === getters.user.profileService,

        authService: (state, getters) => state.authServices[getters.user.authService],
        profileService: (state, getters) => state.profileServices[getters.user.profileService],
    },
    mutations: {
        userSnapshot(state, snapshot) {
            fitin(state, snapshot);
            if (typeof snapshot.users === 'object') {
                state.users = snapshot.users;
            }
            if (snapshot.authServices) {
                state.authServices = { ...state.authServices, ...snapshot.authServices };
            }
            if (snapshot.profileServices) {
                state.profileServices = { ...state.profileServices, ...snapshot.profileServices };
            }
        },
        userMojangInfo(state, info) {
            state.mojangInfo = { ...info };
        },
        userSecurity(state, sec) {
            state.mojangSecurity = sec;
        },
        gameProfile(state, { profile, userId }) {
            const userProfile = state.users[userId];
            if (profile.id in userProfile.profiles) {
                Vue.set(userProfile.profiles, profile.id, profile);
            } else {
                userProfile.profiles[profile.id] = {
                    textures: { SKIN: { url: '' } },
                    ...profile,
                };
            }
        },
        userInvalidate(state) {
            if (state.users[state.selectedUser.id].authService !== 'offline') {
                state.users[state.selectedUser.id].accessToken = '';
            }
        },
        authServiceRemove(state, name) {
            Vue.delete(state.authServices, name);
        },
        profileServiceRemove(state, name) {
            Vue.delete(state.profileServices, name);
        },
        userProfileRemove(state, userId) {
            if (state.users[userId]) {
                if (state.selectedUser.id === userId) {
                    state.selectedUser.id = '';
                    state.selectedUser.profile = '';
                }
                Vue.delete(state.users, userId);
            }
        },
        userProfileAdd(state, profile) {
            if (!state.users[profile.id]) {
                Vue.set(state.users, profile.id, {
                    ...profile,
                    profiles: profile.profiles.map(p => ({ ...p, textures: { SKIN: { url: '' } } }))
                        .reduce((dict, o) => {
                            dict[o.id] = o;
                            return dict;
                        }, {} as { [key: string]: GameProfileAndTexture }),
                });
            } else {
                const user = state.users[profile.id];
                user.accessToken = profile.accessToken;
                user.profiles = profile.profiles.map(p => ({ ...p, textures: { SKIN: { url: '' } } }))
                    .reduce((dict, o) => {
                        dict[o.id] = o;
                        return dict;
                    }, {} as { [key: string]: GameProfileAndTexture });
            }
        },
        userProfileUpdate(state, profile) {
            const user = state.users[profile.id];
            user.accessToken = profile.accessToken;
            profile.profiles.forEach((p) => {
                if (user.profiles[p.id]) {
                    user.profiles[p.id] = {
                        ...user.profiles[p.id],
                        ...p,
                    };
                } else {
                    user.profiles[p.id] = {
                        textures: { SKIN: { url: '' } },
                        ...p,
                    };
                }
            });
        },
        userGameProfileSelect(state, { userId, profileId }) {
            state.selectedUser.id = userId;
            state.selectedUser.profile = profileId;
        },
        authService(state, { name, api }) {
            if (name in state.authServices) {
                state.authServices[name] = api;
            } else {
                Vue.set(state.authServices, name, api);
            }
        },
        profileService(state, { name, api }) {
            if (name in state.profileServices) {
                state.profileServices[name] = api;
            } else {
                Vue.set(state.profileServices, name, api);
            }
        },
    },
};

export default mod;
