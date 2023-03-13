<template>
  <div
    class="relative w-full"
  >
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />

    <v-list
      v-if="!refreshing || versions.length !== 0"
      color="transparent"
    >
      <ErrorView
        :error="error"
        @refresh="refresh"
      />
      <CurseforgeProjectFileItem
        v-for="file in versions"
        :id="file.id"
        :key="file.id"
        :mod-id="modId"
        :name="file.fileName"
        :loader="file.gameVersions.find(v => !Number.isInteger(Number(v[0])))"
        :versions="file.gameVersions.filter(v => Number.isInteger(Number(v[0])))"
        :size="file.fileLength"
        :date="file.fileDate"
        :release-type="file.releaseType"
        @install="emit('install', file)"
      />
    </v-list>
    <v-skeleton-loader
      v-else
      class="children:bg-transparent"
      type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
    />
  </div>
</template>
<script setup lang="ts">
import ErrorView from '@/components/ErrorView.vue'
import { useRefreshable, useService } from '@/composables'
import { kCurseforgeInstall, useCurseforgeInstall } from '@/composables/curseforgeInstall'
import { kModrinthVersionsStatus, useModrinthVersionsStatus } from '@/composables/modrinthVersions'
import { Mod, File } from '@xmcl/curseforge'
import { CurseForgeServiceKey } from '@xmcl/runtime-api'
import CurseforgeProjectFileItem from './CurseforgeProjectFileItem.vue'

const props = defineProps<{
  mod: Mod
  loader: string
  minecraft: string
}>()

const { getModFiles } = useService(CurseForgeServiceKey)
const versions = ref([] as File[])
const modId = computed(() => props.mod.id)
const emit = defineEmits(['install'])
const getMajor = (v: string) => {
  const split = v.split('.')
  if (split.length > 1) {
    return split[0] + '.' + split[1]
  }
  return v
}
const { refresh, refreshing, error } = useRefreshable(async () => {
  // const mcMajor = getMajor(props.minecraft)
  const result = await getModFiles({
    modId: props.mod.id,
    gameVersion: props.minecraft,
    modLoaderType: props.loader === 'fabric' ? 4 : props.loader === 'forge' ? 1 : 0,
  })

  versions.value = result.data
})
onMounted(refresh)
watch(modId, refresh)

provide(kCurseforgeInstall, useCurseforgeInstall(modId, versions, ref(undefined), ref('mc-mods'), ref(undefined)))

</script>
