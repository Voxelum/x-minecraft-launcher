<template>
  <v-dialog
    v-model="isShown"
    :width="480"
    :persistent="true"
  >
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden">
      <!-- Header -->
      <div class="bg-blue-500 px-5 py-3">
        <div class="flex items-center gap-2">
          <v-icon size="22" color="white">
            mdi-server
          </v-icon>
          <h3 class="text-lg font-semibold text-white">
            {{ t('server.joinServer') }}
          </h3>
        </div>
      </div>

      <!-- Content -->
      <div class="px-5 py-4">
        <!-- Server info card -->
        <div
          v-if="server.host"
          class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="status.favicon"
              :src="status.favicon"
              class="w-10 h-10 rounded"
            >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {{ serverName || server.host }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {{ server.host }}:{{ server.port || 25565 }}
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm text-gray-700 dark:text-gray-300">
                {{ status.players.online }}/{{ status.players.max }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {{ status.ping }}ms
              </div>
            </div>
          </div>
          <!-- MOTD -->
          <div
            v-if="status.description"
            class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600"
          >
            <text-component
              :source="typeof status.description === 'string' ? status.description : status.description"
              class="text-xs text-gray-600 dark:text-gray-400"
            />
          </div>
        </div>

        <!-- Server address input -->
        <v-text-field
          v-model="serverField"
          :label="t('server.address')"
          :hint="t('server.addressHint')"
          persistent-hint
          outlined
          dense
          class="mb-3"
          @keydown.enter="refresh"
        />

        <!-- Server name input -->
        <v-text-field
          v-model="serverName"
          :label="t('server.name')"
          :hint="t('server.nameHint')"
          persistent-hint
          outlined
          dense
        />
      </div>

      <!-- Actions -->
      <div class="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <v-btn
            variant="text"
            size="small"
            class="text-gray-600 dark:text-gray-400"
            :loading="pinging"
            @click="refresh"
          >
            <v-icon left size="18">
              mdi-refresh
            </v-icon>
            {{ t('shared.refresh') }}
          </v-btn>
          <div class="flex items-center gap-2">
            <v-btn
              variant="text"
              size="small"
              class="text-gray-600 dark:text-gray-400"
              @click="onCancel"
            >
              {{ t('shared.cancel') }}
            </v-btn>
            <v-btn
              color="blue-500"
              variant="flat"
              size="small"
              class="text-white font-medium"
              :disabled="!server.host"
              @click="onSave"
            >
              {{ t('shared.save') }}
            </v-btn>
          </div>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDialog } from '../composables/dialog'
import { useServerStatus } from '../composables/serverStatus'
import { useService } from '../composables/service'
import { InstanceServiceKey } from '@xmcl/runtime-api'
import { ref, computed, watch } from 'vue'

const { t } = useI18n()
const { updateInstance } = useService(InstanceServiceKey)

const { isShown, hide, parameter } = useDialog('join-server')

const instance = computed(() => parameter.value?.instance)
const serverField = ref('')
const serverName = ref('')

const server = computed(() => ({
  host: serverField.value.split(':')[0] || '',
  port: serverField.value.split(':')[1] ? Number.parseInt(serverField.value.split(':')[1], 10) : undefined,
}))

const { status, pinging, refresh } = useServerStatus(server, ref(undefined))

// Initialize fields when dialog opens
watch(isShown, (shown) => {
  if (shown && instance.value?.server) {
    const s = instance.value.server
    serverField.value = s.port ? `${s.host}:${s.port}` : s.host
    serverName.value = parameter.value?.serverName || ''
  } else if (shown) {
    serverField.value = ''
    serverName.value = ''
  }
})

const onSave = async () => {
  if (!instance.value || !server.value.host) return

  await updateInstance(instance.value.path, {
    server: {
      host: server.value.host,
      port: server.value.port,
    },
  })

  hide()
  parameter.value?.onSave?.()
}

const onCancel = () => {
  hide()
}
</script>
