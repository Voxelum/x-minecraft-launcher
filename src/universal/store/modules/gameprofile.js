import { v4 } from 'uuid'
import { ProfileService, GameProfile } from 'ts-minecraft'

const registered = {
    mojang: ProfileService.mojang,
}

export default {
    namespaced: true,
    mutations: {},
    actions: {
        async fetch(context, { service, uuid, pubKey, cache }) {
            if (!registered[service]) throw new Error(`No such auth option ${service}`);
            if (!uuid || uuid == null) throw new Error('UUID cannot be null');
            const profile = await ProfileService.fetch(uuid)
            if (cache) {
                const tex = await ProfileService.getTextures(profile);
                profile.properties = undefined;
                profile.textures = tex;
            }
            return profile;
        },
        async lookup(context, { service, id, pubKey, cache }) {
            if (!registered[service]) throw new Error(`No such auth option ${service}`);
            const profile = await ProfileService.lookup(id, { api: registered[service], pubKey })
            if (cache) {
                const tex = await ProfileService.getTextures(profile);
                profile.properties = undefined;
                profile.textures = tex;
            }
            return profile;
        },
    },
}
