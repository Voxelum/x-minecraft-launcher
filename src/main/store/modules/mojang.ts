import { fetchJson } from '@xmcl/net';

export default {
    actions: {
        async fetchMojangNews() {
            const { body } = await fetchJson('https://launchermeta.mojang.com/mc/news.json');
            return body;
        },
    },
};
