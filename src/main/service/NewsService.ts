import Service from './Service'

export default class NewsService extends Service {
  async fetchMojangNews () {
    const { body } = await this.networkManager.request('https://launchermeta.mojang.com/mc/news.json').json()
    return body
  }
}
