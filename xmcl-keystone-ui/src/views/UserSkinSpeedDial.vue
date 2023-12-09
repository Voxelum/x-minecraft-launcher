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
          fab
          color="primary"
          @click="load"
        >
          <v-icon>edit</v-icon>
        </v-btn>
      </v-fab-transition>
    </template>
    <v-btn
      v-shared-tooltip.left="() => t('userSkin.importLink')"
      :disabled="disabled || !hasSkin"
      fab
      light
      small
      color="white"
      @click="upload"
    >
      <v-icon>link</v-icon>
    </v-btn>
    <v-btn
      v-shared-tooltip.left="() => t('userSkin.saveTitle')"
      :disabled="disabled"
      fab
      small
      color="blue"
      @click="save"
    >
      <v-icon>save</v-icon>
    </v-btn>
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
