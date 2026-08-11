<template>
  <div ref="scrollElement" class="deployment-file-selector">
    <InstanceManifestFileTree
      v-model="model"
      :scroll-element="scrollElement"
      selectable
      open-all
    />
  </div>
</template>

<script setup lang="ts">
import { provideFileNodes } from '@/composables/instanceFileNodeData'
import type { InstanceFile } from '@xmcl/instance'
import { useVModel } from '@vueuse/core'
import InstanceManifestFileTree from './InstanceManifestFileTree.vue'

const props = defineProps<{
  files: InstanceFile[]
  modelValue: string[]
}>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: string[]): void
}>()
const model = useVModel(props, 'modelValue', emit)
const scrollElement = shallowRef<HTMLElement | null>(null)

provideFileNodes(computed(() => props.files.map(file => ({
  name: file.path.split('/').at(-1) || file.path,
  path: file.path,
  size: file.size ?? 0,
}))))
</script>

<style scoped>
.deployment-file-selector {
  height: 240px;
  overflow: auto;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 6px;
}
</style>
