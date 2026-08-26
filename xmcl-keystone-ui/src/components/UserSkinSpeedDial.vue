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
          icon="edit"
          color="primary"
          :disabled="disabled || !hasSkin"
          @click="load"
        />
      </v-fab-transition>
    </template>
    <v-btn
      v-if="openLibrary"
      v-shared-tooltip.left="() => t('userSkin.libraryTitle')"
      icon="accessibility"
      size="small"
      color="purple"
      :disabled="disabled"
      @click="openLibrary"
    />
    <v-btn
      v-shared-tooltip.left="() => t('userSkin.importLink')"
      icon="link"
      size="small"
      color="white"
      :disabled="disabled || !hasSkin"
      @click="upload"
    />
    <v-btn
      v-shared-tooltip.left="() => t('userSkin.saveTitle')"
      icon="save"
      size="small"
      color="blue"
      :disabled="disabled"
      @click="save"
    />
  </v-speed-dial>
</template>

<script lang="ts" setup>
import { vSharedTooltip } from '@/directives/sharedTooltip'

defineProps<{
  load(): void
  upload(): void
  save(): void
  openLibrary?(): void
  disabled: boolean
  hasSkin: boolean
  hasCape: boolean
  value: boolean
}>()

const { t } = useI18n()

const fab = ref(false)
</script>

<style></style>
