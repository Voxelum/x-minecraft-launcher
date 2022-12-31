<template>
  <HomeUpstreamCardBase
    title="Curseforge"
    icon="$vuetify.icons.curseforge"
    :refreshing="loading"
    :disabled="loading"
    :status="status"
    @update="onUpdate"
    @fix="onReinstall"
    @goto="goToPage"
  >
    <p v-html="t('curseforgeCard.projectHint', { mod: upstream.modId, file: upstream.fileId })" />
    <div
      class="grid grid-cols-1"
    >
      <div v-if="currentFileResource">
        {{ t('curseforgeCard.currentFile') }}:
        <span class="text--primary">
          {{ currentFileResource.name }}
        </span>
      </div>
      <div v-if="latestFile">
        {{ t('curseforgeCard.projectLastFile') }}:
        <span
          class="text--primary"
        >
          {{ latestFile.displayName }}
        </span>
      </div>
    </div>
    <v-alert
      v-if="error"
      class="mt-4"
      dense
      outlined
      type="error"
    >
      {{ error }}
    </v-alert>
  </HomeUpstreamCardBase>
</template>
<script lang="ts" setup>
import { useCurseforgeInstanceUpdate } from '@/composables/instanceUpdate'
import { InstanceData } from '@xmcl/runtime-api'
import HomeUpstreamCardBase from './HomeUpstreamCardBase.vue'

const props = defineProps<{
  instance: InstanceData
  upstream: Required<InstanceData>['upstream'] & { type: 'curseforge-modpack' }
}>()

const { loading, onUpdate, goToPage, status, currentFileResource, latestFile, error, onReinstall } = useCurseforgeInstanceUpdate(props)

const { t } = useI18n()
</script>
