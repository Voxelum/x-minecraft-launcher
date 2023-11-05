<template>
  <v-card
    :color="cardColor"
    class="flex h-full flex-col"
  >
    <v-card-title>
      <v-icon
        left
      >
        gradient
      </v-icon>
      {{ t('shaderPack.name', 2) }}
    </v-card-title>
    <v-card-text
      class="flex-grow overflow-hidden"
    >
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
import { kColorTheme } from '@/composables/colorTheme'
import { kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { injection } from '@/util/inject'

const { cardColor } = injection(kColorTheme)
const { shaderPack } = injection(kInstanceShaderPacks)
const { t } = useI18n()
const { push } = useRouter()

</script>
