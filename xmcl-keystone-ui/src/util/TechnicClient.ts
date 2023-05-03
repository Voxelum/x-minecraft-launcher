export interface Modpack {
  id: string
  name: string
  slug: string
  url: string
  iconUrl: string
}

export class TechnicClient {
  constructor(private baseUrl = 'https://api.technicpack.net') {
  }

  async getModpack(slug: string) {
    const url = this.baseUrl + `/modpack/${slug}`
    const response = await fetch(url)
    const data = await response.json()
    return data
  }

  async getHomeHTML() {
    const url = this.baseUrl + '/discover'
    const response = await fetch(url)
    const data = await response.text()
    return data
  }

  async searchModpack(query: string): Promise<{
    modpacks: Modpack[]
  }> {
    const url = this.baseUrl + `/search?q=${query}&build=build`
    const response = await fetch(url)
    const data = await response.json()
    return data
  }
}
