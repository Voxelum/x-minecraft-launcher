import { v4 } from 'uuid'
import { ProfileService, GameProfile } from 'ts-minecraft'

export default {
    namespaced: true,
    state: {
        api: Object.freeze(Object.assign({}, ProfileService.mojang)),
    },
    mutations: {
        api(state, api) {
            state.api = Object.freeze(Object.assign({}, api));
        },
    },
    actions: {
        async setTexture(context, { data, slim }) {
            const accessToken = context.rootState.user.auth.accessToken;
            const uuid = context.rootState.user.auth.selectedProfile.id;
            return ProfileService.setTexture({
                uuid,
                accessToken,
                type: 'skin',
                texture: {
                    metadata: {
                        model: slim ? 'slim' : 'steve',
                    },
                    data,
                },
            }, context.state.api).catch((e) => {
                console.error(e);
                throw e
            });
        },
        getTextures(context, profile) {
            if (!profile) throw new Error('Profile cannot be undefined') 
            return ProfileService.getTextures(profile);
        },
        fetch(context, { uuid }) {
            if (!uuid) throw new Error('UUID cannot be undefined');
            return ProfileService.fetch(uuid, { api: context.state.api })
        },
        lookup(context, { id }) {
            if (!id) throw new Error('id cannot be undefined');
            return ProfileService.lookup(id, { api: context.state.api })
        },
    },
}
