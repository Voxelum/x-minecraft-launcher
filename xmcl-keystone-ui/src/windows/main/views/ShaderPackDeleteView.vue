<template>
  <v-card>
    <v-card-title
      primary-title
      class="block"
    >
      <div class="mb-3">
        <h3 class="headline mb-0 text-left">
          {{ $t('shaderpack.deletion') }}
        </h3>
      </div>
      <div
        style="overflow: hidden; word-break: break-all;"
      >
        {{ $t('shaderpack.deletionHint', { path: item ? item.path : '' }) }}
      </div>
    </v-card-title>

    <v-divider />
    <v-card-actions>
      <v-btn
        flat
        @click="cancel"
      >
        {{ $t('no') }}
      </v-btn>
      <v-spacer />
      <v-btn
        flat
        color="red"
        :loading="deleting"
        @click="confirm"
      >
        <v-icon left>
          delete
        </v-icon>
        {{ $t('delete.yes') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang=ts>
import { ShaderPackItem } from '../composables/shaderpack'
import { optional, required } from '/@/util/props'

export default defineComponent({
  props: {
    confirm: required<() => void>(Function),
    cancel: required<() => void>(Function),
    deleting: required(Boolean),
    item: optional<ShaderPackItem>(Object),
  },
  setup(props) {
    return {
    }
  },
})
</script>
