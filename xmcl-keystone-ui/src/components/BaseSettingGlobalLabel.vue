<template>
  <v-chip
    v-shared-tooltip="() => global ? t('settingLabel.globalHint') : t('settingLabel.localHint')"
    class="ml-2"
    label
    size="small"
    variant="tonal"
    :model-value="true"
    :prepend-icon="global ? 'public' : 'edit'"
    :color="global ? 'purple-lighten-2' : 'blue-lighten-2'"
    :closable="!global"
    @update:model-value="() => {}"
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
