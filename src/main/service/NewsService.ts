import got from 'got';
import Service from './Service';

export default class NewsService extends Service {
    async fetchMojangNews() {
        const { body } = await got('https://launchermeta.mojang.com/mc/news.json').json();
        return body;
    }
}
