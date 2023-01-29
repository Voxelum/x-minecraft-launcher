<template>
  <div
    class="flex flex-col mb-10"
  >
    <v-card-title>
      {{ t('server.status') }}
    </v-card-title>
    <v-card-text class="flex flex-grow gap-4 items-center">
      <img
        :src="status.favicon || unknownServer"
        style="max-height: 64px;"
      >
      <div class="py-4">
        <text-component
          :source="status.version.name"
          localize
        />
        <v-spacer />
        <text-component
          :source="status.description"
          localize
        />
      </div>
    </v-card-text>
    <v-card-actions>
      <v-chip
        label
        class="mr-2"
        small
        outlined
        :input-value="false"
      >
        <v-avatar left>
          <v-icon>people</v-icon>
        </v-avatar>
        {{ status.players.online }} / {{ status.players.max }}
      </v-chip>
      <v-chip
        :style="{ color: status.ping < 100 ? 'green' : status.ping < 450 ? 'orange' : 'red' }"
        label
        outlined
        small
        :input-value="false"
      >
        <v-avatar left>
          <v-icon
            :style="{ color: status.ping < 100 ? 'green' : status.ping < 450 ? 'orange' : 'red' }"
          >
            signal_cellular_alt
          </v-icon>
        </v-avatar>
        {{ status.ping }} ms
      </v-chip>
      <v-spacer />
      <v-btn
        text
        :loading="pinging"
        @click="refresh"
      >
        <v-icon
          color="primary"
          left
        >
          refresh
        </v-icon>
        {{ t('refresh') }}
      </v-btn>
    </v-card-actions>
  </div>
</template>

<script lang=ts setup>
import { useInstanceServerStatus } from '../composables/serverStatus'
import unknownServer from '@/assets/unknown_server.png'

const { refresh, status, pinging } = useInstanceServerStatus()
const { t } = useI18n()
onMounted(() => {
  if (status.value.ping <= 0) {
    refresh()
  }
})
</script>

<style>
</style>
