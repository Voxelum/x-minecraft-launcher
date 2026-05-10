<template>
  <v-dialog v-model="isShown" :width="500">
    <v-card class="rounded-xl overflow-hidden" data-testid="instance-server-edit-dialog">
      <!-- Header -->
      <div class="px-5 py-4 border-b server-edit__divider bg-[rgba(var(--v-theme-on-surface),0.04)]">
        <div class="flex items-center gap-3">
          <v-icon size="24" color="primary">dns</v-icon>
          <h3 class="text-lg font-semibold">
            {{ isEdit ? t('server.editServer') : t('server.addServer') }}
          </h3>
        </div>
      </div>

      <!-- Content -->
      <div class="px-5 py-4">
        <!-- Server info preview -->
        <div
          v-if="serverHost"
          class="mb-4 p-3 rounded-lg border server-edit__divider bg-[rgba(var(--v-theme-on-surface),0.04)]"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="status.favicon"
              :src="status.favicon"
              class="w-10 h-10 rounded"
            />
            <v-icon v-else icon="dns" size="24" color="primary" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">
                {{ serverName || serverHost }}
              </div>
              <div class="text-xs text-medium-emphasis">
                {{ serverHost }}:{{ serverPort || 25565 }}
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm text-medium-emphasis">
                {{ status.players.online }}/{{ status.players.max }}
              </div>
              <div class="text-xs text-disabled">{{ status.ping }}ms</div>
            </div>
          </div>
          <div
            v-if="status.description"
            class="mt-2 pt-2 border-t server-edit__divider"
          >
            <text-component
              :source="
                typeof status.description === 'string'
                  ? { text: status.description }
                  : status.description
              "
              class="text-xs"
            />
          </div>
        </div>

        <!-- Server name input -->
        <v-text-field
          v-model="serverName"
          :label="t('server.serverName')"
          :hint="t('server.nameHint')"
          persistent-hint
          variant="outlined"
          density="compact"
          data-testid="instance-server-edit-name"
          class="mb-3"
        />

        <!-- Server host and port inputs -->
        <div class="flex gap-3 mb-3">
          <v-text-field
            v-model="serverHost"
            :label="t('server.address')"
            :hint="t('server.addressHint')"
            persistent-hint
            variant="outlined"
            density="compact"
            data-testid="instance-server-edit-host"
            class="flex-1"
            @keydown.enter="refresh"
          />
          <v-text-field
            v-model.number="serverPort"
            :label="t('server.port')"
            type="number"
            :min="1"
            :max="65535"
            variant="outlined"
            density="compact"
            data-testid="instance-server-edit-port"
            style="max-width: 100px"
            @keydown.enter="refresh"
          />
        </div>

        <v-checkbox
          v-model="pinAfterSave"
          :label="t('server.pinAfterSave')"
          density="compact"
          hide-details
          data-testid="instance-server-edit-pin"
        />
      </div>

      <!-- Actions -->
      <div class="px-5 py-3 border-t server-edit__divider bg-[rgba(var(--v-theme-on-surface),0.04)]">
        <div class="flex items-center justify-between">
          <v-btn
            variant="text"
            size="small"
            :loading="pinging"
            @click="refresh"
          >
            <v-icon start size="18">refresh</v-icon>
            {{ t('shared.refresh') }}
          </v-btn>
          <div class="flex items-center gap-2">
            <v-btn
              v-if="isEdit"
              variant="text"
              size="small"
              color="error"
              data-testid="instance-server-edit-remove"
              @click="onRemove"
            >
              <v-icon start size="18">delete</v-icon>
              {{ t('shared.remove') }}
            </v-btn>
            <v-btn
              variant="text"
              size="small"
              @click="onCancel"
            >
              {{ t('shared.cancel') }}
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              size="small"
              class="font-medium"
              :disabled="!serverHost"
              data-testid="instance-server-edit-save"
              @click="onSave"
            >
              {{ t('shared.save') }}
            </v-btn>
          </div>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import TextComponent from '@/components/TextComponent'
import { useDialog } from '../composables/dialog'
import { kInstance } from '../composables/instance'
import { useMinecraftProtocol } from '../composables/protocol'
import { useServerStatus } from '../composables/serverStatus'
import { useService } from '../composables/service'
import { injection } from '../util/inject'
import { InstanceServerInfoServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import { ref, computed, watch } from 'vue'

/**
 * The "Edit instance server" dialog. Drives `servers.dat` for the given
 * instance — adding a new row or editing an existing one. The optional
 * "pin after save" checkbox also writes to `instance.server` so the next
 * launch joins it directly.
 *
 * Dialog parameter shape: {
 *   instancePath: string
 *   server?: { ip: string; name: string; icon?: string; acceptTextures?: 0|1 }
 *   onSaved?: () => void
 * }
 */

interface DialogParams {
  instancePath: string
  server?: { ip: string; name: string; icon?: string; acceptTextures?: 0 | 1 }
  onSaved?: () => void
}

const { t } = useI18n()
const { editInstance } = useService(InstanceServiceKey)
const { addServer, updateServer, removeServer } = useService(InstanceServerInfoServiceKey)

const { isShown, hide, parameter } = useDialog<DialogParams>('instance-server-edit')

const params = computed(() => parameter.value)
const isEdit = computed(() => !!params.value?.server)

const serverHost = ref('')
const serverPort = ref<number | undefined>(undefined)
const serverName = ref('')
const pinAfterSave = ref(false)
// Snapshot of the original row used as the lookup key when editing.
const originalKey = ref<{ host: string; port?: number; name?: string } | null>(null)

const serverRef = computed(() => ({ host: serverHost.value || '', port: serverPort.value }))
const { instance } = injection(kInstance)
const protocol = useMinecraftProtocol(computed(() => instance.value?.runtime.minecraft))
const { status, pinging, refresh } = useServerStatus(serverRef, protocol)

watch(isShown, (shown) => {
  if (!shown) return
  const p = params.value
  if (p?.server) {
    const parsed = parseIp(p.server.ip)
    serverHost.value = parsed.host
    serverPort.value = parsed.port
    serverName.value = p.server.name || ''
    originalKey.value = { host: parsed.host, port: parsed.port, name: p.server.name || undefined }
    pinAfterSave.value = false
  } else {
    serverHost.value = ''
    serverPort.value = undefined
    serverName.value = ''
    originalKey.value = null
    pinAfterSave.value = false
  }
})

async function onSave() {
  const p = params.value
  if (!p?.instancePath || !serverHost.value) return

  if (isEdit.value && originalKey.value) {
    await updateServer({
      instancePath: p.instancePath,
      host: originalKey.value.host,
      port: originalKey.value.port,
      name: originalKey.value.name,
      update: {
        host: serverHost.value,
        port: serverPort.value,
        name: serverName.value || serverHost.value,
      },
    })
  } else {
    await addServer({
      instancePath: p.instancePath,
      host: serverHost.value,
      port: serverPort.value,
      name: serverName.value || serverHost.value,
    })
  }

  if (pinAfterSave.value) {
    await editInstance({
      instancePath: p.instancePath,
      server: {
        host: serverHost.value,
        port: serverPort.value,
        name: serverName.value || serverHost.value,
      },
    })
  }

  hide()
  p.onSaved?.()
}

async function onRemove() {
  const p = params.value
  if (!p?.instancePath || !originalKey.value) return
  await removeServer({
    instancePath: p.instancePath,
    host: originalKey.value.host,
    port: originalKey.value.port,
    name: originalKey.value.name,
  })
  hide()
  p.onSaved?.()
}

function onCancel() {
  hide()
}

function parseIp(ip: string): { host: string; port?: number } {
  if (!ip) return { host: '' }
  const v6 = /^\[([^\]]+)\](?::(\d+))?$/.exec(ip)
  if (v6) return { host: v6[1], port: v6[2] ? Number(v6[2]) : undefined }
  const idx = ip.lastIndexOf(':')
  if (idx >= 0 && /^\d+$/.test(ip.slice(idx + 1))) {
    return { host: ip.slice(0, idx), port: Number(ip.slice(idx + 1)) }
  }
  return { host: ip }
}
</script>

<style scoped>
/* Theme-aware divider that adapts to light/dark, replacing the previous
   hardcoded #333 borders. */
.server-edit__divider {
  border-color: rgba(var(--v-border-color), var(--v-border-opacity)) !important;
}
</style>

