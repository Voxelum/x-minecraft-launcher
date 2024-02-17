<template>
  <v-chip
    v-shared-tooltip="_ => global ? t('settingLabel.globalHint') : t('settingLabel.localHint')"
    class="mb-1 ml-2"
    label
    small
    dark
    :color="global ? 'lighten-2 purple' : 'lighten-2 blue'"
    :close="!global"
    @click.stop="emit('click')"
    @click:close="emit('clear')"
  >
    <template v-if="global">
      {{ t('settingLabel.global') }}
    </template>
    <template v-else>
      {{ t('settingLabel.local') }}
    </template>
  </v-chip>
</template>
<script lang="ts" setup>
import { vSharedTooltip } from '@/directives/sharedTooltip'

defineProps<{
  global: boolean
}>()
const emit = defineEmits(['clear', 'click'])
const { t } = useI18n()
</script>
