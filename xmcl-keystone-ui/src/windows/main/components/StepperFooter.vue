<template>
  <v-layout class="gap-4">
    <v-btn
      text
      :disabled="creating"
      @click="emit('quit')"
    >
      {{ t('cancel') }}
    </v-btn>
    <v-spacer />
    <slot />
    <v-btn
      v-if="next"
      color="primary"
      :loading="creating"
      :disabled="disabled"
      @click="emit('next')"
    >
      {{ t('next') }}
    </v-btn>
    <v-btn
      v-if="create"
      color="primary"
      :loading="creating"
      :disabled="disabled"
      @click="emit('create')"
    >
      {{ t('create') }}
    </v-btn>
  </v-layout>
</template>
<script lang=ts setup>

defineProps<{
  disabled: boolean
  creating: boolean
  create?: boolean
  next?: boolean
}>()

const emit = defineEmits(['quit', 'next', 'create'])
const { t } = useI18n()
</script>
