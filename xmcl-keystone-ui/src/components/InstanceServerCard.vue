<template>
  <div
    v-if="instance?.server?.host"
    class="server-card mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
  >
    <div class="flex items-center gap-2">
      <!-- Server favicon -->
      <img
        v-if="status.favicon"
        :src="status.favicon"
        class="w-8 h-8 rounded"
      >
      <v-icon
        v-else
        icon="mdi-server"
        size="20"
        class="text-blue-500"
      />

      <!-- Server info -->
      <div class="flex-1 min-w-0">
        <div class="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
          {{ serverName || status.description || instance.server.host }}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ instance.server.host }}:{{ instance.server.port || 25565 }}
        </div>
      </div>

      <!-- Players count -->
      <div class="text-right">
        <div class="text-xs text-gray-700 dark:text-gray-300">
          <v-icon size="12" class="text-green-500">mdi-account-group</v-icon>
          {{ status.players.online }}/{{ status.players.max }}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ status.ping }}ms
        </div>
      </div>
    </div>

    <!-- MOTD -->
    <div
      v-if="status.description && typeof status.description === 'string'"
      class="mt-1 pt-1 border-t border-blue-200 dark:border-blue-800"
    >
      <div class="text-xs text-gray-600 dark:text-gray-400 truncate">
        {{ status.description }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Instance } from '@xmcl/instance'
import { useServerStatus } from '../composables/serverStatus'
import { computed, ref } from 'vue'

const props = defineProps<{
  instance: Instance | undefined
}>()

const server = computed(() => props.instance?.server ?? { host: '' })
const serverName = ref('')

const { status } = useServerStatus(server, ref(undefined))
</script>
