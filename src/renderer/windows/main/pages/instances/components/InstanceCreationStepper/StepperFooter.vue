<template>
  <v-layout>
    <v-btn
      flat
      :disabled="creating"
      @click="$emit('quit')"
    >
      {{ $t('cancel') }}
    </v-btn>
    <v-spacer />
    <slot />
    <v-btn
      v-if="next"
      color="primary"
      :loading="creating"
      :disabled="disabled"
      @click="$emit('next')"
    >
      {{ $t('next') }}
    </v-btn>
    <v-btn
      v-if="create"
      color="primary"
      :loading="creating"
      :disabled="disabled"
      @click="$emit('create')"
    >
      {{ $t('create') }}
    </v-btn>
  </v-layout>
</template>
<script lang=ts>
import { defineComponent } from '@vue/composition-api'
import { required, optional } from '/@/util/props'

export default defineComponent({
  props: {
    disabled: required(Boolean),
    creating: required(Boolean),
    create: optional(Boolean),
    next: optional(Boolean),
  },
  emits: ['quit', 'next', 'create'],
})
</script>
