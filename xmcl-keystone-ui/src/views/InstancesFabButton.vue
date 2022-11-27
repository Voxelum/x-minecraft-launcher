<template>
  <transition
    name="scale-transition"
    mode="out-in"
  >
    <v-btn
      v-if="deleting"
      :key="1"
      absolute
      fab
      large
      color="error"
      style="right: 20px; bottom: 20px; transition: all 0.15s ease;"
      :loading="pinging"
      @drop="emit('drop')"
    >
      <v-icon>delete</v-icon>
    </v-btn>
    <v-btn
      v-else
      :key="0"
      absolute
      fab
      large
      color="primary"
      style="right: 20px; bottom: 20px; transition: all 0.15s ease;"
      :loading="pinging"
      @click="refresh"
    >
      <v-icon>refresh</v-icon>
    </v-btn>
  </transition>
</template>
<script lang="ts" setup>
import { useNotifier } from '../composables/notifier'
import { useInstancesServerStatus } from '../composables/serverStatus'

const { t } = useI18n()
const { pinging, refresh: _refresh } = useInstancesServerStatus()
const { notify } = useNotifier()

defineProps<{ deleting: boolean }>()
const emit = defineEmits(['drop'])

function refresh() {
  _refresh().then(() => {
    notify({ level: 'success', title: t('instances.refreshServers') })
  }, () => {
    notify({ level: 'error', title: t('instances.refreshServers') })
  })
}
</script>
