<template>
  <v-list
    class="non-moveable"
    three-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title class="whitespace-pre-wrap">
          {{ t('setup.dataRoot.description') }}
        </v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>{{ t('setup.defaultPath') }}</v-list-item-title>
        <v-list-item-subtitle>{{ defaultPath }}</v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>{{ t('setup.path') }}</v-list-item-title>
        <v-list-item-subtitle>{{ value }}</v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="justify-center">
        <v-btn
          outlined
          text
          style="margin-right: 10px;"
          @click="browse"
        >
          {{ t('browse') }}
        </v-btn>
      </v-list-item-action>
    </v-list-item>
    <v-list-item
      v-for="d of drives"
      :key="d.mounted"
      v-ripple
      class="m-2 mx-3 cursor-pointer rounded-lg hover:bg-[rgba(123,123,123,0.5)]"
      @click="onSelect(d)"
    >
      <v-list-item-avatar>
        <v-icon>storage</v-icon>
      </v-list-item-avatar>

      <v-list-item-content>
        <v-list-item-title class="flex w-full flex-grow-0 p-0 align-baseline">
          {{ d.mounted }}
          <div class="flex-grow" />

          <span
            class="whitespace-normal text-[hsla(0,0%,100%,.7)]"
            style="font-size: 14px;"
          >
            {{ d.selectedPath }}
          </span>
        </v-list-item-title>
        <v-progress-linear
          class="my-2 p-0"
          :value="d.used / (d.available + d.used) * 100"
        />
        <v-list-item-subtitle class="flex">
          <span class="">
            {{ t('disk.available') }}:
            {{ (d.available / 1024 / 1024 / 1024).toFixed(2) }}G
            {{ t('disk.used') }}:
            {{ (d.used / 1024 / 1024 / 1024).toFixed(2) }}G
          </span>
          <div class="flex-grow" />
          <span>
            {{ d.capacity }}
          </span>
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>
<script lang="ts">
import { Drive } from '@xmcl/runtime-api'

import { required } from '@/util/props'

export default defineComponent({
  props: {
    defaultPath: required(String),
    drives: required<Drive[]>(Array),
    value: required(String),
  },
  setup(props, context) {
    const { showOpenDialog } = windowController
    const { t } = useI18n()
    async function browse() {
      const { filePaths } = await showOpenDialog({
        title: t('browse'),
        defaultPath: props.value,
        properties: ['openDirectory', 'createDirectory'],
      })
      if (filePaths && filePaths.length !== 0) {
        context.emit('input', filePaths[0])
      }
    }
    function onSelect(drive: Drive) {
      context.emit('input', drive.selectedPath)
    }
    return {
      t,
      browse,
      onSelect,
    }
  },
})
</script>
