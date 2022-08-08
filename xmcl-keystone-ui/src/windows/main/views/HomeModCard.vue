<template>
  <v-card>
    <v-card-title>
      <v-icon left>
        extension
      </v-icon>
      Mods
    </v-card-title>
    <v-card-text>
      {{ t('mod.enabled', { count: modCounts }) }}
    </v-card-text>
    <v-card-actions>
      <v-btn
        :disabled="refreshing > 0"
        color="teal accent-4"
        text
        @click="push('/mod-setting')"
      >
        {{ t('mod.manage') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts" setup>
import { InstanceModsServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import { useI18n, useRouter, useSemaphore, useService } from '/@/composables'

const { state } = useService(InstanceModsServiceKey)
const modCounts = computed(() => state.mods.length)
const { push } = useRouter()
const refreshing = useSemaphore(computed(() => 'instance:mods'))
const { t } = useI18n()
</script>
