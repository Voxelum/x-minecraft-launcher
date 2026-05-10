<template>
  <div class="flex gap-4">
    <v-btn
      data-testid="add-instance-cancel"
      :disabled="creating"
      variant="text"
      rounded="pill"
      @click="emit('quit')"
    >
      {{ t('shared.cancel') }}
    </v-btn>
    <v-spacer />
    <slot />
    <v-btn
      v-if="next"
      data-testid="add-instance-next"
      color="primary"
      variant="flat"
      rounded="pill"
      :loading="creating"
      :disabled="disabled"
      @click="emit('next')"
    >
      {{ t('shared.next') }}
    </v-btn>
    <v-btn
      v-if="create"
      data-testid="add-instance-create"
      color="primary"
      variant="flat"
      rounded="pill"
      :loading="creating"
      :disabled="disabled"
      @click="emit('create')"
    >
      {{ t('create') }}
    </v-btn>
  </div>
</template>
<script lang=ts setup>

defineProps<{
  disabled: boolean
  creating: boolean
  create?: boolean
  next?: boolean
}>()

const emit = defineEmits(['quit', 'next', 'create', 'back'])
const { t } = useI18n()
</script>
