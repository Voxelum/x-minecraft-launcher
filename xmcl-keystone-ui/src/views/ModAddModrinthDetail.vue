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
      <ModrinthProjectVersionsTile
        v-for="v of versions"
        :key="v.id"
        :source="v"
        @install="emit('install', v)"
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
import { kModrinthVersionsStatus, useModrinthVersionsStatus } from '@/composables/modrinthVersions'
import { ProjectVersion, SearchResultHit } from '@xmcl/modrinth'
import { ModrinthServiceKey } from '@xmcl/runtime-api'
import ModrinthProjectVersionsTile from './ModrinthProjectVersionsTile.vue'

const props = defineProps<{
  hint: SearchResultHit
  loader: string
  minecraft: string
}>()

const { getProjectVersions } = useService(ModrinthServiceKey)
const versions = ref([] as ProjectVersion[])
const projectId = computed(() => props.hint.project_id)
const emit = defineEmits(['install'])
const getMajor = (v: string) => {
  const split = v.split('.')
  if (split.length > 1) {
    return split[0] + '.' + split[1]
  }
  return v
}
const { refresh, refreshing, error } = useRefreshable(async () => {
  const mcMajor = getMajor(props.minecraft)
  const gameVersions = props.hint.versions.filter(v => getMajor(v) === mcMajor)
  versions.value = await getProjectVersions({
    projectId: projectId.value,
    loaders: props.loader ? [props.loader] : undefined,
    gameVersions,
  })
})
onMounted(refresh)
watch(projectId, refresh)
provide(kModrinthVersionsStatus, useModrinthVersionsStatus(versions, projectId))

</script>
