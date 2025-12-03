<template>
  <div
    v-shared-tooltip="_ => name"
    class="flex flex-col items-center cursor-pointer rounded-lg p-2 transition-all duration-200 hover:bg-white/10 dark:hover:bg-black/20"
    style="width: 100px;"
    @click="emit('click', $event)"
  >
    <v-img
      :src="image"
      width="64"
      height="64"
      class="rounded-lg"
    />
    <div
      class="mt-2 text-center text-sm truncate w-full"
      :title="name"
    >
      {{ name }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { BuiltinImages } from '@/constant'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { getBanner } from '@/util/banner'
import { Instance } from '@xmcl/instance'
import { useInstanceServerStatus } from '../composables/serverStatus'

const props = defineProps<{ instance: Instance }>()
const emit = defineEmits(['click'])

const { status } = useInstanceServerStatus(computed(() => props.instance))

const name = computed(() => props.instance.name || `Minecraft ${props.instance.runtime.minecraft}`)

const image = computed(() => {
  if (status.value.favicon && status.value.favicon !== BuiltinImages.unknownServer) {
    return status.value.favicon
  }
  if (props.instance.icon) {
    return props.instance.icon
  }
  const banner = getBanner(props.instance.runtime.minecraft)
  if (banner) {
    return banner
  }
  return BuiltinImages.unknownServer
})
</script>
