<template>
  <v-card class="flex flex-col h-full">
    <v-card-title>
      <v-icon
        left
      >
        map
      </v-icon>
      {{ t('save.name', 2) }}
    </v-card-title>
    <v-card-text class="flex-grow">
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
import { useService } from '@/composables'

const { state } = useService(InstanceSavesServiceKey)
const savesLength = computed(() => state.saves.length)
const { t } = useI18n()
const { push } = useRouter()

</script>
