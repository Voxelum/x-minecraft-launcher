<template>
  <v-card>
    <v-card-title>
      <v-icon
        left
      >
        gradient
      </v-icon>
      {{ t('shaderPack.name', 2) }}
    </v-card-title>
    <v-card-text>
      {{ shaderPack ? t('shaderPack.enable', { name: shaderPack }) : t('shaderPack.empty') }}
    </v-card-text>
    <v-card-actions>
      <v-btn
        text
        color="teal accent-4"
        @click="push('/shader-pack-setting')"
      >
        {{ t('shaderPack.manage') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts" setup>
import { InstanceModsServiceKey, InstanceOptionsServiceKey } from '@xmcl/runtime-api'
import { useService } from '/@/composables'

const { state } = useService(InstanceOptionsServiceKey)
const shaderPack = computed(() => state.shaderoptions.shaderPack)
const { t } = useI18n()
const { push } = useRouter()

</script>
