<template>
  <v-card
    v-draggable-card
    hover
    dark
    draggable
    class="white--text draggable-card flex"
    style="margin-top: 10px; padding: 0 10px; transition-duration: 0.2s;"
  >
    <v-layout class="gap-5" flex>
      <v-flex class="flex items-center justify-center">{{ pack.name }}</v-flex>
      <v-flex style="flex-grow: 1"></v-flex>
      <v-flex style="flex-grow: 0">
        <v-switch v-model="isEnabled" />
      </v-flex>
    </v-layout>
  </v-card>
</template>
<script lang="ts">
import { computed, defineComponent } from '@vue/composition-api';
import { ShaderPackItem } from '/@/hooks/useShaderpacks';
import { required } from '/@/util/props';

export default defineComponent({
  props: {
    pack: required<ShaderPackItem>(Object),
  },
  setup(props, context) {
    const isEnabled = computed({
      get() { return props.pack.enabled },
      set(v: boolean) {
        console.log(v)
        if (v) {
          context.emit('select', props.pack)
        }
      }
    })
    function onInput(value: boolean) {

    }
    return { onInput, isEnabled }
  }
})
</script>