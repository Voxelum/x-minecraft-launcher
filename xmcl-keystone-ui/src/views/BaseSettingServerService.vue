<template>
  <SettingCard
    :title="t('server.serviceManager')"
    icon="settings_system_daydream"
    data-testid="server-service-manager"
  >
    <div class="flex flex-col gap-3 px-4 py-3">
      <div class="flex items-center gap-3">
        <v-switch
          v-model="enabled"
          color="primary"
          density="compact"
          hide-details
          :label="t('server.serviceManagedLaunch')"
          @update:model-value="saveDesiredService"
        />
        <v-spacer />
        <v-chip size="small" variant="tonal">{{ managerLabel }}</v-chip>
        <v-chip size="small" variant="tonal" :color="status?.active ? 'success' : undefined">
          {{ status?.active ? t('baseSetting.info.running') : status?.installed ? t('baseSetting.info.stopped') : t('server.serviceNotInstalled') }}
        </v-chip>
        <v-btn icon size="small" variant="text" :disabled="!targetConfigured" :loading="statusLoading" @click="refreshStatus">
          <v-icon size="18">refresh</v-icon>
        </v-btn>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <v-text-field
          v-model="serviceName"
          prepend-inner-icon="badge"
          :label="t('server.serviceName')"
          :hint="t('server.serviceNameHint')"
          persistent-hint
          @change="saveDesiredService"
        />
        <v-text-field
          v-if="target === 'remote'"
          v-model="startCommand"
          prepend-inner-icon="terminal"
          :label="t('server.serviceStartCommand')"
          :hint="t('server.remoteStartCommandHint')"
          persistent-hint
          @change="saveDesiredService"
        />
        <div v-else class="flex items-center text-sm opacity-60">
          {{ t('server.serviceWindowsCommandHint') }}
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <v-btn color="primary" variant="tonal" prepend-icon="install_desktop" :disabled="!targetConfigured" :loading="installing" @click="onInstall">
          {{ t('server.serviceInstall') }}
        </v-btn>
        <v-btn variant="tonal" color="green" prepend-icon="play_arrow" :disabled="!status?.installed" :loading="starting" @click="onStart">
          {{ t('server.remoteStartService') }}
        </v-btn>
        <v-btn variant="tonal" color="orange" prepend-icon="restart_alt" :disabled="!status?.installed" :loading="restarting" @click="onRestart">
          {{ t('server.remoteRestartService') }}
        </v-btn>
        <v-btn variant="tonal" color="red" prepend-icon="stop" :disabled="!status?.installed" :loading="stopping" @click="onStop">
          {{ t('server.remoteStopService') }}
        </v-btn>
        <v-btn variant="text" color="red" :disabled="!status?.installed" :loading="uninstalling" @click="onUninstall">
          {{ t('server.remoteUninstallService') }}
        </v-btn>
      </div>

      <v-alert v-if="status?.error" type="error" variant="tonal" density="compact">
        {{ status.error }}
      </v-alert>
      <v-alert v-else-if="actionMessage" :type="actionMessage.ok ? 'success' : 'error'" variant="tonal" density="compact">
        {{ actionMessage.message || t('server.remoteActionSuccess') }}
      </v-alert>
    </div>
  </SettingCard>
</template>

<script setup lang="ts">
import SettingCard from '@/components/SettingCard.vue'
import { useRefreshable, useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceServerLaunch } from '@/composables/instanceServerLaunch'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'
import type { InstanceServerConfig } from '@xmcl/instance'
import { InstanceServiceKey, ServerServiceKey, type ServerServiceActionResult, type ServerServiceStatus } from '@xmcl/runtime-api'

const { target } = defineProps<{ target: 'local' | 'remote' }>()
const { t } = useI18n()
const { path, instance } = injection(kInstance)
const { generateLaunchOptions } = injection(kInstanceLaunch)
const { userProfile } = injection(kUserContext)
const serverLaunch = injection(kInstanceServerLaunch)
const { editInstance } = useService(InstanceServiceKey)
const service = useService(ServerServiceKey)

const enabled = ref(false)
const serviceName = ref('')
const startCommand = ref('/bin/sh server.sh')
const status = ref<ServerServiceStatus>()
const actionMessage = ref<ServerServiceActionResult>()
const statusLoading = ref(false)

const managerLabel = computed(() => status.value?.manager === 'windows-service'
  ? t('server.serviceWindows')
  : status.value?.manager === 'systemd-user'
    ? t('server.serviceSystemd')
    : target === 'local' ? t('server.serviceWindows') : t('server.serviceSystemd'))
const targetConfigured = computed(() => target === 'local' || !!instance.value.remoteServer)

function defaultServiceName() {
  const slug = instance.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `xmcl-${slug || 'server'}`
}

function syncDesiredService() {
  const desired = instance.value.serverConfig?.service
  enabled.value = desired?.enabled ?? false
  serviceName.value = desired?.name || instance.value.remoteServer?.serviceName || defaultServiceName()
  startCommand.value = desired?.startCommand || instance.value.remoteServer?.startCommand || '/bin/sh server.sh'
}

function getServerConfig(): InstanceServerConfig {
  return instance.value.serverConfig ?? {
    eula: false,
    motd: 'A Minecraft Server',
    port: 25565,
    maxPlayers: 20,
    onlineMode: false,
    nogui: true,
    world: { mode: 'create' },
    deployment: {
      config: { policy: 'mirror' },
      mods: { policy: 'mirror' },
      world: { policy: 'initialize' },
      extra: { policy: 'overlay' },
    },
    service: { enabled: false, name: '' },
  }
}

async function saveDesiredService() {
  const current = getServerConfig()
  await editInstance({
    instancePath: path.value,
    serverConfig: {
      ...current,
      service: {
        enabled: enabled.value,
        name: serviceName.value || defaultServiceName(),
        startCommand: target === 'remote' ? startCommand.value || undefined : undefined,
      },
    },
  })
}

async function refreshStatus() {
  if (!targetConfigured.value) {
    status.value = undefined
    actionMessage.value = undefined
    return
  }
  statusLoading.value = true
  try {
    status.value = await service.getStatus(path.value, target)
  } finally {
    statusLoading.value = false
  }
}

const { refresh: onInstall, refreshing: installing } = useRefreshable(async () => {
  actionMessage.value = undefined
  await saveDesiredService()
  let launchOptions
  if (target === 'local') {
    const version = await serverLaunch.prepareServer()
    launchOptions = await generateLaunchOptions(path.value, userProfile.value, '', 'server', { version }, true)
  }
  actionMessage.value = await service.install({
    instancePath: path.value,
    target,
    name: serviceName.value || defaultServiceName(),
    startCommand: target === 'remote' ? startCommand.value : undefined,
    launchOptions,
  })
  await refreshStatus()
})

const { refresh: onStart, refreshing: starting } = useRefreshable(async () => {
  actionMessage.value = await service.start(path.value, target)
  await refreshStatus()
})
const { refresh: onStop, refreshing: stopping } = useRefreshable(async () => {
  actionMessage.value = await service.stop(path.value, target)
  await refreshStatus()
})
const { refresh: onRestart, refreshing: restarting } = useRefreshable(async () => {
  actionMessage.value = await service.restart(path.value, target)
  await refreshStatus()
})
const { refresh: onUninstall, refreshing: uninstalling } = useRefreshable(async () => {
  actionMessage.value = await service.uninstall(path.value, target)
  await refreshStatus()
})

watch([path, () => target, () => instance.value.remoteServer], () => {
  syncDesiredService()
  refreshStatus()
}, { immediate: true })
</script>