<template>
  <v-card>
    <v-card-title>
      <v-icon
        left
      >
        map
      </v-icon>
      {{ tc('save.name', 2) }}
    </v-card-title>
    <v-card-text>
      {{ t('save.createdWorlds', { count: savesLength }) }}
    </v-card-text>
    <v-card-actions>
      <v-btn
        text
        color="teal accent-4"
        @click="push('/save')"
      >
        {{ t('save.manage') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts" setup>
import { InstanceModsServiceKey, InstanceOptionsServiceKey, InstanceSavesServiceKey } from '@xmcl/runtime-api'
import { useI18n, useRouter, useService } from '/@/composables'

const { state } = useService(InstanceSavesServiceKey)
const savesLength = computed(() => state.saves.length)
const { tc, t } = useI18n()
const { push } = useRouter()

</script>
