<template>
  <v-tooltip
    :close-delay="0"
    left
  >
    <template #activator="{ on }">
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
              :disabled="disabled || !hasSkin"
              fab
              color="primary"
              v-on="on"
              @click="load"
            >
              <v-icon>edit</v-icon>
            </v-btn>
          </v-fab-transition>
        </template>
        <v-tooltip
          v-if="hasSkin"
          :close-delay="0"
          left
        >
          <template #activator="{ on: tooltip }">
            <v-btn
              :disabled="disabled || !hasSkin"
              fab
              light
              small
              color="white"
              v-on="tooltip"
              @click="upload"
            >
              <v-icon>link</v-icon>
            </v-btn>
          </template>
          {{ t('userSkin.importLink') }}
        </v-tooltip>
        <v-tooltip
          :close-delay="0"
          left
        >
          <template #activator="{ on: tooltip }">
            <v-btn
              :disabled="disabled"
              fab
              small
              color="blue"
              v-on="tooltip"
              @click="save"
            >
              <v-icon>save</v-icon>
            </v-btn>
          </template>
          {{ t('userSkin.saveTitle') }}
        </v-tooltip>
      </v-speed-dial>
    </template>
    {{ t('userSkin.importFile') }}
  </v-tooltip>
</template>

<script lang=ts setup>

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
