import { MojangChallenge, MojangChallengeResponse } from '@xmcl/user'
import { File, FormData, getGlobalDispatcher, request } from 'undici'
import { MinecraftOwnershipResponse, MinecraftProfileErrorResponse, MinecraftProfileResponse } from '../entities/user'

export interface Skin {
  id: string
  state: 'ACTIVE' | string
  url: string
  variant: 'SLIM' | 'STEVE'
}
export interface Cape {
  id: string
  state: 'ACTIVE' | string
  url: string
  /**
   * Capes name
   */
  alias: string
}

export interface Profile {
  id: string
  name: string
  skins: Skin[]
  capes: Cape[]
}

export class SetNameError extends Error {
  public path: string
  public errorType: string
  public error: string
  public details: object
  public errorMessage: string
  public developerMessage: string

  constructor(message: string, err: any) {
    super(message)
    this.name = 'SetNameError'
    this.path = err.path
    this.errorType = err.errorType
    this.error = err.error
    this.details = err.details
    this.errorMessage = err.errorMessage
    this.developerMessage = err.developerMessage
  }
}

export class UnauthorizedError extends Error {
  public path: string
  public errorMessage: string
  public developerMessage: string

  constructor(err: any) {
    super(err.errorMessage)
    this.name = 'SetNameError'
    this.path = err.path
    this.errorMessage = err.errorMessage
    this.developerMessage = err.developerMessage
  }
}

export interface NameChangeInformation {
  changedAt: string
  createdAt: string
  nameChangeAllowed: boolean
}

export enum NameAvailability {
  DUPLICATE = 'DUPLICATE',
  AVAILABLE = 'AVAILABLE',
  NOT_ALLOWED = 'NOT_ALLOWED',
}

export class MojangClient {
  constructor(readonly getAccessToken: () => string, private dispatcher = getGlobalDispatcher()) { }

  async setName(name: string) {
    const token = this.getAccessToken()
    const resp = await request(`https://api.minecraftservices.com/minecraft/profile/name/${name}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    })
    switch (resp.statusCode) {
      case 200: return await resp.body.json() as Profile
      case 400: throw new SetNameError('Name is unavailable (Either taken or has not become available)', await resp.body.json())
      case 403: throw new SetNameError('Name is unavailable (Either taken or has not become available)', await resp.body.json())
      case 401: throw new SetNameError('Unauthorized (Bearer token expired or is not correct)', await resp.body.json())
      case 429: throw new SetNameError('Too many requests sent', await resp.body.json())
      case 500: throw new SetNameError('Timed out (API lagged out and could not respond)', await resp.body.json())
    }
    throw new SetNameError('Unknown error', await resp.body.json())
  }

  async getNameChangeInformation() {
    const token = this.getAccessToken()
    const resp = await request('https://api.minecraftservices.com/minecraft/profile/namechange', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    })
    return await resp.body.json() as NameChangeInformation
  }

  async checkNameAvailability(name: string): Promise<NameAvailability> {
    const token = this.getAccessToken()
    const resp = await request(`https://api.minecraftservices.com/minecraft/profile/name/${name}/available`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    })
    const result = await resp.body.json()
    return result.status
  }

  async getProfile(): Promise<Profile> {
    const token = this.getAccessToken()
    const resp = await request('https://api.minecraftservices.com/minecraft/profile', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    })
    return await resp.body.json() as Profile
  }

  async setSkin(fileName: string, skin: string | Buffer, variant: 'slim' | 'classic') {
    const body = typeof skin === 'string' ? JSON.stringify({ url: skin, variant }) : getSkinFormData(skin, fileName, variant)
    const token = this.getAccessToken()
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    }

    if (typeof body === 'string') {
      headers['Content-Type'] = 'application/json'
    }

    const resp = await request('https://api.minecraftservices.com/minecraft/profile/skins', {
      method: 'POST',
      headers,
      body,
      throwOnError: false,
    })

    const profileResponse: MinecraftProfileResponse | MinecraftProfileErrorResponse = await resp.body.json()

    if ('error' in profileResponse || 'errorMessage' in profileResponse) {
      // throw new UserException({ type: 'fetchMinecraftProfileFailed', ...profileResponse },
      //   `Cannot login to Microsoft! ${profileResponse.errorMessage}`)
    }

    return profileResponse
  }

  async resetSkin() {
    const token = this.getAccessToken()
    const resp = await request('https://api.minecraftservices.com/minecraft/profile/skins/active', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      throwOnError: false,
      dispatcher: this.dispatcher,
    })
    if (resp.statusCode === 401) {
      throw new UnauthorizedError(await resp.body.json())
    }
  }

  async hideCape() {
    const token = this.getAccessToken()
    const resp = await request('https://api.minecraftservices.com/minecraft/profile/capes/active', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      throwOnError: false,
      dispatcher: this.dispatcher,
    })
    if (resp.statusCode === 401) {
      throw new UnauthorizedError(await resp.body.json())
    }
  }

  async showCape(capeId: string) {
    const token = this.getAccessToken()
    const resp = await request('https://api.minecraftservices.com/minecraft/profile/capes/active', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ capeId }),
      throwOnError: false,
      dispatcher: this.dispatcher,
    })
    if (resp.statusCode === 401) {
      throw new UnauthorizedError(await resp.body.json())
    }
    if (resp.statusCode === 400) {
      throw new Error()
    }
    await resp.body.json()
  }

  async verifySecurityLocation() {
    const token = this.getAccessToken()
    const resp = await request('https://api.mojang.com/user/security/location', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      throwOnError: false,
      dispatcher: this.dispatcher,
    })

    if (resp.statusCode === 204) {
      return true
    }
    return false
  }

  async getSecurityChallenges() {
    const token = this.getAccessToken()
    const resp = await request('https://api.mojang.com/user/security/challenges', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      throwOnError: false,
      dispatcher: this.dispatcher,
    })

    if (resp.statusCode === 401) {
      throw new UnauthorizedError(await resp.body.json())
    }
    return await resp.body.json() as MojangChallenge[]
  }

  async submitSecurityChallenges(answers: MojangChallengeResponse[]) {
    const token = this.getAccessToken()
    const resp = await request('https://api.mojang.com/user/security/location', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(answers),
      throwOnError: false,
      dispatcher: this.dispatcher,
    })

    if (resp.statusCode === 204) {
      return
    }
    if (resp.statusCode === 401) {
      throw new UnauthorizedError(await resp.body.json())
    }
    throw new Error()
  }

  /**
   * Return the owner ship list of the player with those token.
   */
  async checkGameOwnership() {
    const token = this.getAccessToken()
    const mcResponse = await request('https://api.minecraftservices.com/entitlements/mcstore', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    })

    if (mcResponse.statusCode === 401) {
      throw new UnauthorizedError(await mcResponse.body.json())
    }
    const result: MinecraftOwnershipResponse = await mcResponse.body.json()

    return result
  }
}

function getSkinFormData(buf: Buffer, fileName: string, variant: 'slim' | 'classic') {
  const form = new FormData()
  form.append('variant', variant)
  const file = new File([buf], fileName, { type: 'image/png' })
  form.append('file', file)
  return form
}
