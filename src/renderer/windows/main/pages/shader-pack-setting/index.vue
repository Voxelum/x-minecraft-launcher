<template>
  <v-container
    grid-list-md
    fill-height
    style="overflow: auto;"
    @dragover.prevent>
    <v-layout column fill-height>
      <v-toolbar
        dark
        flat
        color="transparent"
      >
        <v-toolbar-title>{{ $tc('shaderpack.name', 2) }}</v-toolbar-title>
        <v-spacer />
        <!-- <v-btn
          flat
          @click="showCopyFromDialog"
        >
          <v-icon left>
            input
          </v-icon>
          {{ $t('save.copyFrom.title') }}
        </v-btn>
        <v-btn  
          flat
          @click="doImport"
        >
          <v-icon left>
            move_to_inbox
          </v-icon>
          {{ $t('save.import') }}
        </v-btn> -->
      </v-toolbar>
      <v-layout column>
        <v-flex class="gap-5">
          <transition-group tag="div" name="transition-list">
            <ShaderPackCard v-for="pack in shaderPacks" :key="pack.hash" :pack="pack"></ShaderPackCard>
          </transition-group>
        </v-flex>
      </v-layout>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from '@vue/composition-api';
import ShaderPackCard from './ShaderPackCard.vue';
import { useShaderpacks } from '/@/hooks/useShaderpacks';

export default defineComponent({
  setup() {
    const { shaderPacks } = useShaderpacks()

    return {
      shaderPacks,
    }
  },
  components: { ShaderPackCard }
})
</script>