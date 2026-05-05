/* eslint-disable @typescript-eslint/no-redeclare */
import { fetch, FormData } from 'undici'

/**
 * Users defined question when they register this account
 *
 * The question id, content mapping is:
 *
 * 1. What is your favorite pet's name?
 * 2. What is your favorite movie?
 * 3. What is your favorite author's last name?
 * 4. What is your favorite artist's last name?
 * 5. What is your favorite actor's last name?
 * 6. What is your favorite activity?
 * 7. What is your favorite restaurant?
 * 8. What is the name of your favorite cartoon?
 * 9. What is the name of the first school you attended?
 * 10. What is the last name of your favorite teacher?
 * 11. What is your best friend's first name?
 * 12. What is your favorite cousin's name?
 * 13. What was the first name of your first girl/boyfriend?
 * 14. What was the name of your first stuffed animal?
 * 15. What is your mother's middle name?
 * 16. What is your father's middle name?
 * 17. What is your oldest sibling's middle name?
 * 18. In what city did your parents meet?
 * 19. In what hospital were you born?
 * 20. What is your favorite team?
 * 21. How old were you when you got your first computer?
 * 22. How old were you when you got your first gaming console?
 * 23. What was your first video game?
 * 24. What is your favorite card game?
 * 25. What is your favorite board game?
 * 26. What was your first gaming console?
 * 27. What was the first book you ever read?
 * 28. Where did you go on your first holiday?
 * 29. In what city does your grandmother live?
 * 30. In what city does your grandfather live?
 * 31. What is your grandmother's first name?
 * 32. What is your grandfather's first name?
 * 33. What is your least favorite food?
 * 34. What is your favorite ice cream flavor?
 * 35. What is your favorite ice cream flavor?
 * 36. What is your favorite place to visit?
 * 37. What is your dream job?
 * 38. What color was your first pet?
 * 39. What is your lucky number?s
 *
 */
export interface MojangChallenge {
  readonly answer: { id: number }
  readonly question: { id: number; question: string }
}

export interface MojangChallengeResponse {
  id: number
  answer: string
}
export interface MinecraftProfileResponse {
  id: string // the real uuid of the account, woo
  name: string // the mc user name of the account
  skins: [
    {
      id: string
      state: 'ACTIVE' | 'string'
      url: string
      variant: 'CLASSIC' | string
      alias: 'STEVE' | string
    },
  ]
  capes: [
    {
      id: string
      state: 'ACTIVE' | string
      url: string
    },
  ]
}

export interface MinecraftOwnershipResponse {
  /**
   * If the account doesn't own the game, the items array will be empty.
   */
  items: Array<{
    name: 'product_minecraft' | 'game_minecraft'
    /**
     * jwt signature
     */
    signature: string
  }>
  /**
   * jwt signature
   */
  signature: string
  keyId: string
}

export interface MinecraftProfileErrorResponse {
  path: '/minecraft/profile'
  errorType: 'NOT_FOUND' | string
  error: string | 'NOT_FOUND'
  errorMessage: string
  developerMessage: string
}
export interface MojangSkin {
  id: string
  state: 'ACTIVE' | 'INACTIVE'
  url: string
  variant: 'SLIM' | 'CLASSIC'
}
export interface MojangCape {
  id: string
  state: 'ACTIVE' | 'INACTIVE'
  url: string
  /**
   * Capes name
   */
  alias: string
}

export interface MicrosoftMinecraftProfile {
  id: string
  name: string
  skins: MojangSkin[]
  capes: MojangCape[]
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

export class SetSkinError extends Error {
  public path: string
  public errorType: string
  public error: string
  public details: object
  public errorMessage: string
  public developerMessage: string

  constructor(message: string, err: any) {
    super(message)
    this.name = 'SetSkinError'
    this.path = err.path
    this.errorType = err.errorType
    this.error = err.error
    this.details = err.details
    this.errorMessage = err.errorMessage
    this.developerMessage = err.developerMessage
  }
}

export class MojangError extends Error {
  public path: string
  public errorMessage: string
  public developerMessage: string

  constructor(err: any) {
    super(err.errorMessage)
    this.path = err.path
    this.errorMessage = err.errorMessage
    this.developerMessage = err.developerMessage
    Object.assign(this, err)
  }
}

export class UnauthorizedError extends MojangError {
  name = 'UnauthorizedError'
  constructor(err: any) {
    super(err)
  }
}

export class ProfileNotFoundError extends MojangError {
  name = 'ProfileNotFoundError'

  constructor(err: any) {
    super(err)
  }
}

export interface MojangClientOptions {
  fetch?: typeof fetch
  FormData?: typeof FormData
  File?: typeof File
}

/**
 * The mojang api client. Please referece https://wiki.vg/Mojang_API.
 *
 * All the apis need user to authenticate the access token from microsoft.
 * @see {@link MicrosoftAuthenticator}
 */
export class MojangClient {
  private fetch: typeof fetch
  protected FormData: typeof FormData
  protected File: typeof File

  constructor(options?: MojangClientOptions) {
    this.fetch = options?.fetch || fetch
    this.FormData = options?.FormData || FormData
    this.File = options?.File || File
  }

  async setName(name: string, token: string, signal?: AbortSignal) {
    const resp = await this.fetch(
      `https://api.minecraftservices.com/minecraft/profile/name/${name}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      },
    )
    switch (resp.status) {
      case 200:
        return (await resp.json()) as MicrosoftMinecraftProfile
      case 400:
        throw new SetNameError(
          'Name is unavailable (Either taken or has not become available)',
          await resp.json(),
        )
      case 403:
        throw new SetNameError(
          'Name is unavailable (Either taken or has not become available)',
          await resp.json(),
        )
      case 401:
        throw new SetNameError(
          'Unauthorized (Bearer token expired or is not correct)',
          await resp.json(),
        )
      case 429:
        throw new SetNameError('Too many requests sent', await resp.json())
      case 500:
        throw new SetNameError(
          'Timed out (API lagged out and could not respond)',
          await resp.json(),
        )
    }
    throw new SetNameError('Unknown error', await resp.json())
  }

  async getNameChangeInformation(token: string) {
    const resp = await this.fetch(
      'https://api.minecraftservices.com/minecraft/profile/namechange',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return (await resp.json()) as NameChangeInformation
  }

  async checkNameAvailability(
    name: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<NameAvailability> {
    const resp = await this.fetch(
      `https://api.minecraftservices.com/minecraft/profile/name/${name}/available`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      },
    )
    const result = (await resp.json()) as any
    return result.status
  }

  async getProfile(token: string, signal?: AbortSignal): Promise<MicrosoftMinecraftProfile> {
    const resp = await this.fetch('https://api.minecraftservices.com/minecraft/profile', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    })
    if (resp.headers.get('content-type')?.toLocaleLowerCase() !== 'application/json') {
      throw new Error(await resp.text())
    }
    const json = (await resp.json()) as any
    if (resp.ok) {
      return json as MicrosoftMinecraftProfile
    } else if (json.error === 'NOT_FOUND') {
      throw new ProfileNotFoundError(json)
    } else if (resp.status === 401) {
      throw new UnauthorizedError(json)
    }
    throw Object.assign(new Error('Unknown Error'), json)
  }

  async setSkin(
    fileName: string,
    skin: string | Buffer,
    variant: 'slim' | 'classic',
    token: string,
    signal?: AbortSignal,
  ) {
    const getSkinFormData = (buf: Buffer, fileName: string, variant: 'slim' | 'classic') => {
      const form = new this.FormData()
      form.append('variant', variant)
      const file = new this.File([buf] as any, fileName, { type: 'image/png' })
      form.append('file', file)
      return form
    }
    const body =
      typeof skin === 'string'
        ? JSON.stringify({ url: skin, variant })
        : getSkinFormData(skin, fileName, variant)
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    }

    if (typeof body === 'string') {
      headers['Content-Type'] = 'application/json'
    }

    const resp = await this.fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
      method: 'POST',
      headers,
      body,
      signal,
    })

    const profileResponse: MinecraftProfileResponse | MinecraftProfileErrorResponse =
      (await resp.json()) as any

    if (resp.status === 401) {
      throw new UnauthorizedError(await resp.json())
    }

    if ('error' in profileResponse || 'errorMessage' in profileResponse) {
      throw new SetSkinError(`Fail to set skin ${profileResponse.errorMessage}`, profileResponse)
    }

    return profileResponse
  }

  async resetSkin(token: string, signal?: AbortSignal) {
    const resp = await this.fetch(
      'https://api.minecraftservices.com/minecraft/profile/skins/active',
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      },
    )
    if (resp.status === 401) {
      throw new UnauthorizedError(await resp.json())
    }
  }

  async hideCape(token: string, signal?: AbortSignal) {
    const resp = await this.fetch(
      'https://api.minecraftservices.com/minecraft/profile/capes/active',
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      },
    )
    if (resp.status === 401) {
      throw new UnauthorizedError(await resp.json())
    }
  }

  async showCape(capeId: string, token: string, signal?: AbortSignal) {
    const resp = await this.fetch(
      'https://api.minecraftservices.com/minecraft/profile/capes/active',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ capeId }),
        signal,
      },
    )
    if (resp.status === 401) {
      throw new UnauthorizedError(await resp.json())
    }
    if (resp.status === 400) {
      throw new Error()
    }
    const profile = (await resp.json()) as MicrosoftMinecraftProfile
    return profile
  }

  async verifySecurityLocation(token: string, signal?: AbortSignal) {
    const resp = await this.fetch('https://api.mojang.com/user/security/location', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    })

    if (resp.status === 204) {
      return true
    }
    return false
  }

  async getSecurityChallenges(token: string) {
    const resp = await this.fetch('https://api.mojang.com/user/security/challenges', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (resp.status === 401) {
      throw new UnauthorizedError(await resp.json())
    }
    return (await resp.json()) as MojangChallenge[]
  }

  async submitSecurityChallenges(answers: MojangChallengeResponse[], token: string) {
    const resp = await this.fetch('https://api.mojang.com/user/security/location', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(answers),
    })

    if (resp.status === 204) {
      return
    }
    if (resp.status === 401) {
      throw new UnauthorizedError(await resp.json())
    }
    throw new Error()
  }

  /**
   * Return the owner ship list of the player with those token.
   */
  async checkGameOwnership(token: string, signal?: AbortSignal) {
    const mcResponse = await this.fetch('https://api.minecraftservices.com/entitlements/mcstore', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    })

    if (mcResponse.status === 401) {
      throw new UnauthorizedError(await mcResponse.text())
    }

    if (
      !mcResponse.ok ||
      mcResponse.headers.get('content-type')?.toLocaleLowerCase() !== 'application/json'
    ) {
      throw new Error(await mcResponse.text())
    }

    const result = (await mcResponse.json()) as MinecraftOwnershipResponse

    return result
  }
}
