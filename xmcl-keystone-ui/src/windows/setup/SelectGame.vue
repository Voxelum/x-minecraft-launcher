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
          {{ $t('step.game.description') }}
        </v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>{{ $t('defaultPath') }}</v-list-item-title>
        <v-list-item-subtitle>{{ defaultPath }}</v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>{{ $t('path') }}</v-list-item-title>
        <v-list-item-subtitle>{{ value }}</v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="justify-center">
        <v-btn
          outlined
          text
          style="margin-right: 10px;"
          @click="browse"
        >
          {{ $t('browse') }}
        </v-btn>
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>
<script lang=ts>
import { defineComponent, reactive, toRefs } from '@vue/composition-api'
import { Drive } from '@xmcl/runtime-api/setup'
import { useI18n } from '/@/composables'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    defaultPath: required(String),
    value: required(String),
  },
  setup(props, context) {
    const dialog = windowController
    const { $t } = useI18n()
    async function browse() {
      const { filePaths } = await dialog.showOpenDialog({
        title: $t('browse'),
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
      browse,
      onSelect,
    }
  },
})
</script>
