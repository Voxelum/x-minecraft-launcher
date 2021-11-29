import { InjectionKey, reactive, Ref, toRefs } from '@vue/composition-api'
import { useCurrentUser, useMinecraftVersions, useService } from '/@/hooks'
import { InstanceData, RuntimeVersions } from '/@shared/entities/instance.schema'
import { InstanceServiceKey } from '/@shared/services/InstanceService'

type ToRefs<T> = {
  [K in keyof T]: Ref<T[K]>
}

export const CreateOptionKey: InjectionKey<ToRefs<InstanceData>> = Symbol('CreateOption')
