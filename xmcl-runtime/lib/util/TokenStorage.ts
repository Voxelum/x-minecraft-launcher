import { getPassword, setPassword } from 'keytar'

export class TokenCache {
  private cache: Record<string, string> = {}

  async getToken(service: string, account: string) {
    const key = `${service}-${account}`
    if (this.cache[key]) {
      return this.cache[key]
    }
    const token = await getPassword(service, account)
    if (token) {
      this.cache[key] = token
    }
    return token
  }

  async setToken(service: string, account: string, token: string) {
    const key = `${service}-${account}`
    this.cache[key] = token
    await setPassword(service, account, token)
  }
}
