import { v4 } from 'uuid'
import { ProfileService, GameProfile } from 'ts-minecraft'

const registered = {}
export default {
    initialize() {
        registered.mojang = ProfileService.mojang
    },

    proxy: {
        register(id, service) {
            if (registered[id]) {
                throw new Error(`duplicated id: ${id}`)
            }
            registered[id] = service;
        },
    },

    actions: {
        async fetch({ service, uuid, pubKey, cache }) {
            if (!registered[service]) throw new Error(`No such auth option ${service}`);
            if (!uuid || uuid == null) throw new Error('UUID cannot be null')
            const profile = await ProfileService.fetch(uuid, { api: registered[service], pubKey })
            if (cache) {
                const tex = await GameProfile.cacheTextures(profile);
                profile.properties = undefined;
                profile.textures = tex;
            }
            return profile;
        },
        async lookup({ service, id, pubKey, cache }) {
            if (!registered[service]) throw new Error(`No such auth option ${service}`);
            const profile = await ProfileService.lookup(id, { api: registered[service], pubKey })
            if (cache) {
                const tex = await GameProfile.cacheTextures(profile);
                profile.properties = undefined;
                profile.textures = tex;
            }
            return profile;
        },
        services() {
            return Array.from(registered.keys())
        },
    },
}
