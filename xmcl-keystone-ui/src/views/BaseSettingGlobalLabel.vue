<template>
  <v-tooltip
    top
    :color="global ? 'lighten-3 purple' : 'lighten-3 blue'"
    transition="scroll-y-transition"
  >
    <template #activator="{on}">
      <v-chip
        class="ml-2 mb-1"
        label
        small
        dark
        :color="global ? 'lighten-2 purple' : 'lighten-2 blue'"
        :close="!global"
        v-on="on"
        @click.stop="emit('click')"
        @click:close="onClose()"
      >
        <template v-if="global">
          {{ t('settingLabel.global') }}
        </template>
        <template v-else>
          {{ t('settingLabel.local') }}
        </template>
      </v-chip>
    </template>
    {{ global ? t('settingLabel.globalHint') : t('settingLabel.localHint') }}
  </v-tooltip>
</template>
<script lang="ts" setup>
defineProps<{
  global: boolean
}>()
const emit = defineEmits(['clear', 'click'])
const { t } = useI18n()
const onClose = () => {
  emit('clear')
}
const onClick = () => {
  emit('click')
}
</script>
