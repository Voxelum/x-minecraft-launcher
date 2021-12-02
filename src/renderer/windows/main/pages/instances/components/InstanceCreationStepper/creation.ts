import { InjectionKey, Ref } from '@vue/composition-api'
import { InstanceData } from '/@shared/entities/instance.schema'

type ToRefs<T> = {
  [K in keyof T]: Ref<T[K]>
}

export const CreateOptionKey: InjectionKey<ToRefs<InstanceData>> = Symbol('CreateOption')
