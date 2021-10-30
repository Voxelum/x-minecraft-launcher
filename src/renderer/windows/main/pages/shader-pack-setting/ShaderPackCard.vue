<template>
  <v-card v-draggable-card hover dark draggable class="white--text draggable-card">
    {{ pack.name }}
    <v-switch />
  </v-card>
</template>
<script lang="ts">
import { defineComponent } from '@vue/composition-api';
import { required } from '/@/util/props';
import { ShaderPackResource } from '/@shared/entities/resource';

export default defineComponent({
  props: {
    pack: required<ShaderPackResource>(Object)
  },
  setup() {
    return {}
  }
})
</script>