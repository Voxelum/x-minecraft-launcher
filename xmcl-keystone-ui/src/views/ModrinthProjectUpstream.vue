<template>
  <v-card
    outlined
    class="relative flex flex-shrink flex-grow-0 flex-col"
  >
    <v-list color="transparent">
      <v-subheader>
        {{ t('modrinthCard.currentVersion') }}
      </v-subheader>
      <v-list-item>
        <v-list-item-content v-if="currentVersionResource">
          <v-list-item-title>
            {{ currentVersionResource.name }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ getExpectedSize(currentVersionResource.size) }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-content v-else>
          <v-alert
            class="mb-0"
            type="warning"
          >
            {{ t('upstream.missingModpackMetadata') }}
          </v-alert>
        </v-list-item-content>
      </v-list-item>
      <v-subheader>
        {{ t('modrinthCard.projectLastUpdateVersion') }}
      </v-subheader>
      <ErrorView
        :error="error"
        @click="onUpdate"
      />
      <v-skeleton-loader
        v-if="refreshing"
        type="list-item-avatar-two-line"
      />
      <ModrinthProjectVersionsTile
        v-else-if="latestVersion"
        :source="latestVersion"
        @install="onUpdate"
      />
    </v-list>
  </v-card>
</template>
<script setup lang="ts">
import ErrorView from '@/components/ErrorView.vue'
import { useModrinthInstanceUpdate } from '@/composables/instanceUpdate'
import { getExpectedSize } from '@/util/size'
import { InstanceData } from '@xmcl/runtime-api'
import ModrinthProjectVersionsTile from './ModrinthProjectVersionsTile.vue'

const props = defineProps<{
  upstream: Required<InstanceData>['upstream'] & { type: 'modrinth-modpack' }
  project: string
}>()
const { t } = useI18n()

const { currentVersionResource, error, onUpdate, status, latestVersion, refreshing } = useModrinthInstanceUpdate(props, computed(() => props.project))

</script>
