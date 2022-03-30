<template>
  <v-dialog
    :value="instance.path"
    width="400"
    persistent
  >
    <v-card>
      <v-card-title>
        <h2>{{ $t('profile.delete') }}</h2>
      </v-card-title>
      <v-card-text>
        <span
          style="overflow: hidden; word-break: break-all;"
        >{{ $t('profile.deleteHint', { name: instance.name, id: instance.path }) }}</span>
      </v-card-text>
      <v-card-actions>
        <v-btn
          text
          @click="cancel"
        >
          {{ $t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn
          text
          color="red"
          @click="confirm"
        >
          <v-icon left>
            delete
          </v-icon>
          {{ $t('yes') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    instance: required<{ path: string; name: string }>(Object),
    confirm: required<() => void>(Function),
    cancel: required<() => void>(Function),
  },
})
</script>

<style>
</style>
