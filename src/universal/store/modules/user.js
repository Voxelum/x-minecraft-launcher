import Vue from 'vue';
import { fitin } from 'universal/utils/object';

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
 * selectLoginMode, select the loginMode
 * 
 * getGameProfile, get profile by user uuid or user name
 * selectGameProfileService, select the profile service 
 * 
 * @type import('./user').UserModule
 */
const mod = {
    state: {
        // user data
        profiles: {},
        selectedUser: '',
        selectedUserProfile: '',

        clientToken: '',

        info: null,

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

        loginHistory: [],

        refreshingSecurity: false,
        refreshingSkin: false,
        security: false,
    },
    getters: {
        avaiableGameProfiles: state => Object.values(state.profiles)
            .map(p => p.profiles.map(prof => ({ ...prof, userId: p.id, authService: p.authService, profileService: p.profileService, account: p.account })))
            .reduce((a, b) => [...a, ...b], []),
        selectedUser: state => state.profiles[state.selectedUser]
            || { account: '', profileService: '', authService: 'offline', accessToken: '', profiles: [], properties: {} },
        selectedGameProfile: (state, getters) => getters.selectedUser.profiles.find(p => p.id === state.selectedUserProfile)
            || { id: '', name: '', textures: { SKIN: { url: '' } } },

        logined: (_, getters) => getters.selectedUser.accessToken !== '',
        offline: (_, getters) => getters.selectedUser.authService === 'offline',

        authServices: state => ['offline', ...Object.keys(state.authServices)],
        profileServices: state => Object.keys(state.profileServices),

        isServiceCompatible: (_, getters) => getters.selectedUser.authService === getters.selectedUser.profileService,

        authService: (state, getters) => state.authServices[getters.selectedUser.authService],
        profileService: (state, getters) => state.profileServices[getters.selectedUser.profileService],
    },
    mutations: {
        userSnapshot(state, snapshot) {
            fitin(state, snapshot);
            if (typeof snapshot.profiles === 'object') {
                state.profiles = snapshot.profiles;
            }
            if (snapshot.authServices) {
                state.authServices = { ...state.authServices, ...snapshot.authServices };
            }
            if (snapshot.profileServices) {
                state.profileServices = { ...state.profileServices, ...snapshot.profileServices };
            }
        },
        mojangInfo(state, info) {
            state.info = { ...info };
        },
        refreshingSecurity(state, r) {
            state.refreshingSecurity = r;
        },
        refreshingSkin(state, r) {
            state.refreshingSkin = r;
        },
        userSecurity(state, sec) {
            state.security = sec;
        },
        updateUserProfile(state, userProfile) {
            const user = state.profiles[state.selectedUser];
            user.accessToken = userProfile.accessToken;
            const missing = userProfile.profiles.filter(p => user.profiles.find(up => up.id !== p.id))
                .map(p => ({ ...p, textures: { SKIN: { url: '' } } }));
            const remaining = user.profiles.filter(p => userProfile.profiles.find(ap => ap.id === p.id));
            user.profiles = [...remaining, ...missing];
        },
        updateGameProfile(state, { profile, userId }) {
            const userProfile = state.profiles[userId];
            const index = userProfile.profiles.findIndex(p => p.id === profile.id);
            if (index !== -1) {
                Vue.set(userProfile.profiles, index, profile);
            } else {
                userProfile.profiles.push(profile);
            }
        },
        invalidateAuth(state) {
            if (state.profiles[state.selectedUser].authService !== 'offline') {
                state.profiles[state.selectedUser].accessToken = '';
            }
        },
        addUserProfile(state, user) {
            if (!state.profiles[user.id]) {
                // state.profiles[user.id] = user;
                Vue.set(state.profiles, user.id, user);
            }

            if (user.account) {
                state.loginHistory.push(user.account);
            }
        },
        removeService(state, name) {
            Vue.delete(state.authServices, name);
            Vue.delete(state.profileServices, name);
        },
        removeUserProfile(state, userId) {
            if (state.profiles[userId]) {
                if (state.selectedUser === userId) {
                    state.selectedUser = '';
                    state.selectedUserProfile = '';
                }
                Vue.delete(state.profiles, userId);
            }
        },
        setUserProfile(state, { userId, profileId }) {
            state.selectedUserProfile = profileId;
            state.selectedUser = userId;
        },
        authService(state, { name, api }) {
            Vue.set(state.authServices, name, api);
        },
        profileService(state, { name, api }) {
            Vue.set(state.profileServices, name, api);
        },
    },
};

export default mod;
