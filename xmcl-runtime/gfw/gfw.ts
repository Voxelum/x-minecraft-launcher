import { InjectionKey } from '~/app'

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
