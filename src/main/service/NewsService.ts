import { Net } from '@xmcl/minecraft-launcher-core';
import Service from './Service';

export default class NewsService extends Service {
    async fetchMojangNews() {
        const { body } = await Net.fetchJson('https://launchermeta.mojang.com/mc/news.json');
        return body;
    }
}
