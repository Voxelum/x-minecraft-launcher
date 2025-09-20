import { InjectionKey } from '~/app'

/**
 * GFW is the environment detection result of current network environment.
 * It will be detected once per launch and stored in memory.
 * It will not be persisted.
 * It will be used to determine which mirror to use and some other network related features.
 */
export const kGFW: InjectionKey<GFW> = Symbol('GFW')

export class GFW {
  inside = false

  env: 'cn' | 'yandex' | 'global' = 'global'

  constructor(readonly signal: Promise<'cn' | 'yandex' | 'global'>) {
    signal.then(env => {
      this.env = env
      this.inside = this.env === 'cn'
    })
  }
}
