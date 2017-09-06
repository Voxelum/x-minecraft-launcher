import {
    v4,
} from 'uuid'

const fs = require('fs')
const {
    AuthService,
    ProfileService,
    GameProfile,
} = require('ts-minecraft')

const registered = new Map()
async function authMojang({ account, password, clientToken }) {
    const auth = await AuthService.yggdrasilAuth({
        username: account,
        password,
        clientToken: clientToken || v4(),
    })
    const profile = await ProfileService.fetch(auth.selectedProfile.id);
    const textures = await GameProfile.cacheTextures(profile);
    profile.properties['textures'] = textures;
    auth.selectedProfile = profile;
    return auth;
}
export default {
    initialize() {
        registered.set('offline', ({
            account,
            clientToken,
        }) => AuthService.offlineAuth(account));
        registered.set('mojang', authMojang);
    },

    proxy: {
        register(id, func) {
            if (registered.has(id)) {
                throw new Error(`duplicated id: ${id}`)
            }
            registered.set(id, func)
        },

    },

    actions: {
        login(option) {
            return new Promise((resolve, reject) => {
                if (registered.has(option.mode)) {
                    resolve(registered.get(option.mode)(option))
                } else {
                    reject(`No such auth option ${option.mode}`)
                }
            });
        },
        modes() {
            return Array.from(registered.keys())
        },
        // TODO implement other auth function
    },
}
