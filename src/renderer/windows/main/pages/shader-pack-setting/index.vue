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
        <v-flex >
          <transition-group tag="div" name="transition-list" class="flex gap-5">
            <ShaderPackCard v-for="pack in shaderPacks" :key="pack.value" :pack="pack" @select="onSelect"></ShaderPackCard>
          </transition-group>
        </v-flex>
      </v-layout>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from '@vue/composition-api';
import ShaderPackCard from './ShaderPackCard.vue';
import { ShaderPackItem, useShaderpacks } from '/@/hooks/useShaderpacks';

export default defineComponent({
  setup() {
    const { shaderPacks, selectedShaderPack } = useShaderpacks()

    function onSelect(pack: ShaderPackItem) {
      selectedShaderPack.value = pack.value
    }

    return {
      shaderPacks,
      onSelect,
    }
  },
  components: { ShaderPackCard }
})
</script>