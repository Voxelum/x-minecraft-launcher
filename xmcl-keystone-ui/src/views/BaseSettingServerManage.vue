<template>
  <SettingCard
    :title="t('server.target')"
    icon="dns"
    data-testid="server-target-selector"
  >
    <div class="flex items-center gap-3 px-4 py-3">
      <v-btn-toggle
        v-model="target"
        mandatory
        divided
        variant="outlined"
        color="primary"
      >
        <v-btn value="local" prepend-icon="computer" data-testid="server-target-local">
          {{ t('server.targetLocal') }}
        </v-btn>
        <v-btn value="remote" prepend-icon="cloud" data-testid="server-target-remote">
          {{ remoteLabel }}
        </v-btn>
      </v-btn-toggle>
      <span class="text-sm opacity-60">
        {{ target === 'local' ? t('server.targetLocalHint') : t('server.targetRemoteHint') }}
      </span>
    </div>
    <BaseSettingServerRemote v-if="target === 'remote'" />
  </SettingCard>

  <BaseSettingServerService :target="target" />
  <BaseSettingServerRun :key="target" :target="target" />
</template>

<script setup lang="ts">
import SettingCard from '@/components/SettingCard.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceServerLaunch } from '@/composables/instanceServerLaunch'
import { kRemoteServer, useRemoteServer } from '@/composables/remoteServer'
import { injection } from '@/util/inject'
import { useLocalStorage } from '@vueuse/core'
import BaseSettingServerRemote from './BaseSettingServerRemote.vue'
import BaseSettingServerRun from './BaseSettingServerRun.vue'
import BaseSettingServerService from './BaseSettingServerService.vue'

const { t } = useI18n()
const { path, instance } = injection(kInstance)
const serverLaunch = injection(kInstanceServerLaunch)
const remote = useRemoteServer(path, instance)
provide(kRemoteServer, remote)
const targets = useLocalStorage<Record<string, 'local' | 'remote'>>('instanceServerTargets', {})
const target = computed({
  get: () => targets.value[path.value] ?? 'local',
  set: (value: 'local' | 'remote') => {
    targets.value = { ...targets.value, [path.value]: value }
    serverLaunch.target.value = value
  },
})
const remoteLabel = computed(() => instance.value.remoteServer?.name || instance.value.remoteServer?.host || t('server.targetRemote'))

watch(target, (value) => { serverLaunch.target.value = value }, { immediate: true })
</script>