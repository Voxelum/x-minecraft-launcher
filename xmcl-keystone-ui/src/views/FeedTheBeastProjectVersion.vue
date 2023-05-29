<template>
  <div
    class="flex gap-4 overflow-auto p-4 xl:flex-row flex-col"
  >
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <!-- {{ version }} -->
    <div class="flex gap-5 mx-4">
      <v-text-field
        v-if="minecraft"
        flat
        :loading="refreshing"
        :disabled="refreshing"
        :value="minecraft"
        label="Minecraft"
        dense
        readonly
      >
        <template #prepend-inner>
          <img
            :src="'image://builtin/minecraft'"
            width="32"
          >
        </template>
      </v-text-field>
      <v-text-field
        v-if="forge"
        :loading="refreshing"
        :disabled="refreshing"
        flat
        dense
        label="Forge"
        :value="forge"
        readonly
      >
        <template #prepend-inner>
          <img
            :src="'image://builtin/forge'"
            width="32"
          >
        </template>
      </v-text-field>
      <v-text-field
        v-if="fabricLoader"
        :loading="refreshing"
        :disabled="refreshing"
        flat
        dense
        label="Fabric"
        :value="fabricLoader"
        readonly
      >
        <template #prepend-inner>
          <img
            :src="'image://builtin/fabric'"
            width="32"
          >
        </template>
      </v-text-field>
    </div>
    <v-skeleton-loader
      v-if="refreshing"
      class="flex flex-col gap-3 overflow-auto"
      type="list-item-avatar-three-line, paragraph"
    />
    <InstanceManifestFileTree
      v-else
      v-model="selected"
    />
  </div>
</template>

<script lang=ts setup>
import { FTBFile, FTBVersion } from '@xmcl/runtime-api'
import InstanceManifestFileTree from '../components/InstanceManifestFileTree.vue'
import { useFeedTheBeastProjectVersion } from '../composables/ftb'
import { InstanceFileNode, provideFileNodes } from '@/composables/instanceFileNodeData'

const props = defineProps<{ id: number; version: FTBVersion }>()

const { versionManifest, refreshing } = useFeedTheBeastProjectVersion(computed(() => props.id), computed(() => props.version))

const selected = ref([])

const minecraft = computed(() => versionManifest.value?.targets.find(t => t.name === 'minecraft')?.version)
const forge = computed(() => versionManifest.value?.targets.find(t => t.name === 'forge')?.version)
const fabricLoader = computed(() => versionManifest.value?.targets.find(t => t.name === 'fabric')?.version)

provideFileNodes(computed(() => {
  const man = versionManifest.value
  if (!man) { return [] }
  function getNode(file: FTBFile): InstanceFileNode {
    return {
      path: file.path.replace('./', '') + file.name,
      name: file.name,
      size: file.size,
    }
  }
  return man.files.map(getNode)
}))
// const { refresh, refreshing, manifest } = useFeedTheBeastProject(computed(() => props.id))

// const avatar = computed(() => manifest.value?.art.find(a => a.type === 'square') || manifest.value?.art[0])
// const title = computed(() => manifest.value?.name || '')
// const shortDescription = computed(() => manifest.value?.synopsis ?? '')
// const description = computed(() => manifest.value?.description ?? '')

</script>
