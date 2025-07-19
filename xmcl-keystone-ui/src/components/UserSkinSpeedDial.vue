<template>
  <v-speed-dial
    v-model="fab"
    style="z-index: 3; display: flex; justify-content: center"
    direction="top"
    :open-on-hover="true"
  >
    <template #activator>
      <v-fab-transition>
        <v-btn
          v-if="value"
          v-model="fab"
          v-shared-tooltip.left="() => t('userSkin.importFile')"
          :disabled="disabled || !hasSkin"
          icon="edit"
          color="primary"
          @click="load"
        />
      </v-fab-transition>
    </template>
    <v-btn
      v-shared-tooltip.left="() => t('userSkin.importLink')"
      :disabled="disabled || !hasSkin"
      icon="link"
      size="small"
      color="white"
      @click="upload"
    />
    <v-btn
      v-shared-tooltip.left="() => t('userSkin.saveTitle')"
      :disabled="disabled"
      icon="save"
      size="small"
      color="blue"
      @click="save"
    />
  </v-speed-dial>
</template>

<script lang=ts setup>
import { vSharedTooltip } from '@/directives/sharedTooltip'

defineProps<{
  load():void
  upload():void
  save():void
  disabled: boolean
  hasSkin: boolean
  hasCape: boolean
  value: boolean
}>()

const { t } = useI18n()

const fab = ref(false)
</script>

<style>
</style>
