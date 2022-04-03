import { InjectionKey } from '@vue/composition-api'
import { Framework } from 'vuetify'

export const VuetifyInjectionKey: InjectionKey<Framework> = Symbol('vuetify')
