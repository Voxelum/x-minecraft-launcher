<template>
  <v-card>
    <v-card-title>
      <v-icon left>
        extension
      </v-icon>
      Mods
    </v-card-title>
    <v-card-text>
      <template v-if="refreshing > 0">
        <v-skeleton-loader type="paragraph" />
      </template>
      <template v-else>
        {{ t('mod.enabled', { count: modCounts }) }}
      </template>
    </v-card-text>
    <v-card-actions>
      <v-btn
        :disabled="refreshing > 0"
        :loading="refreshing > 0"
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
import { useSemaphore, useService } from '/@/composables'

const { state } = useService(InstanceModsServiceKey)
const modCounts = computed(() => state.mods.length)
const { push } = useRouter()
const refreshing = useSemaphore(computed(() => 'instance:mods'))
const { t } = useI18n()
</script>
