import { computed, reactive } from '@vue/composition-api';
import { useService } from '.';
import { InstanceOptionsServiceKey } from '../../shared/services/InstanceOptionsService';
import { ResourceServiceKey } from '/@shared/services/ResourceService';

export function useShaderpacks() {
  const { state } = useService(ResourceServiceKey)
  const { state: options } = useService(InstanceOptionsServiceKey)

  const shaderPacks = computed(() => state.shaderpacks)
  const data = reactive({
    shaderPack: options.shaderoptions.shaderPack
  })

  return {
    shaderPacks,
  }
}
