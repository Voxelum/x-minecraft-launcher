<template>
  <v-card>
    <v-card-title>
      <v-icon
        left
      >
        palette
      </v-icon>
      {{ t('resourcepack.name', 2) }}
    </v-card-title>
    <v-card-text>
      {{ t('resourcepack.enable', { count: resourcePackCount }) }}
    </v-card-text>
    <v-card-actions>
      <v-btn
        text
        color="teal accent-4"
        @click="push('/resource-pack-setting')"
      >
        {{ t('resourcepack.manage') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts" setup>
import { InstanceOptionsServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'

const { state } = useService(InstanceOptionsServiceKey)
const resourcePackCount = computed(() => state.options.resourcePacks.length)
const { t } = useI18n()
const { push } = useRouter()

</script>
