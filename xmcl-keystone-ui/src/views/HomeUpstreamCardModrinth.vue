<template>
  <HomeUpstreamCardBase
    title="Modrinth"
    icon="$vuetify.icons.modrinth"
    :refreshing="loading"
    :disabled="loading"
    :status="status"
    @update="onUpdate"
    @fix="onReinstall"
    @goto="goToPage"
  >
    <p v-html="t('modrinthCard.projectHint', { id: upstream.projectId })" />
    <div
      class="grid grid-cols-2"
    >
      <div v-if="currentVersion">
        {{ t('modrinthCard.currentVersion') }}:
        <span class="text--primary">
          {{ currentVersion.version_number }}
        </span>
      </div>
      <div v-if="latestVersion">
        {{ t('modrinthCard.projectLastUpdateVersion') }}:
        <span
          class="text--primary"
        >
          {{ latestVersion.version_number }}
        </span>
      </div>
    </div>
  </HomeUpstreamCardBase>
</template>
<script lang="ts" setup>
import { useModrinthInstanceUpdate } from '@/composables/instanceUpdate'
import { InstanceData } from '@xmcl/runtime-api'
import HomeUpstreamCardBase from './HomeUpstreamCardBase.vue'

const props = defineProps<{
  instance: InstanceData
  upstream: Required<InstanceData>['upstream'] & { type: 'modrinth-modpack' }
}>()

const { loading, onUpdate, goToPage, status, currentVersion, latestVersion, onReinstall } = useModrinthInstanceUpdate(props)

const { t } = useI18n()
</script>
