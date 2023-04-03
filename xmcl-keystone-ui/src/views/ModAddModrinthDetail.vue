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
import { kModrinthVersionsStatus, useModrinthVersions, useModrinthVersionsStatus } from '@/composables/modrinthVersions'
import { SearchResultHit } from '@xmcl/modrinth'
import ModrinthProjectVersionsTile from './ModrinthProjectVersionsTile.vue'

const props = defineProps<{
  hint: SearchResultHit
  loader: string
  minecraft: string
}>()

const projectId = computed(() => props.hint.project_id)
const emit = defineEmits(['install'])
const getMajor = (v: string) => {
  const split = v.split('.')
  if (split.length > 1) {
    return split[0] + '.' + split[1]
  }
  return v
}
const { error, refresh, refreshing, versions } = useModrinthVersions(projectId, false,
  computed(() => props.loader ? [props.loader] : undefined),
  computed(() => props.hint.versions.filter(v => getMajor(v) === getMajor(props.minecraft))))

provide(kModrinthVersionsStatus, useModrinthVersionsStatus(versions, projectId))

</script>
