<template>
  <div class="mt-2">
    <v-divider />
    <div class="flex flex-1 flex-grow-0 p-5 ">
      <v-btn
        v-if="prev"
        text
        large
        :disabled="disabled"
        :loading="loading"
        @click="emit('prev')"
      >
        {{ t('previous') }}
      </v-btn>
      <div class="flex-grow" />
      <v-btn
        v-if="next"
        large
        color="primary"
        :disabled="disabled"
        :loading="loading"
        @click="emit('next')"
      >
        {{ finish ? t('confirm') : t('next') }}
      </v-btn>
    </div>
  </div>
</template>

<script lang=ts setup>
const props = defineProps<{
  disabled?: boolean
  loading: boolean
  finish?: boolean
  prev?: boolean
  next?: boolean
}>()
const emit = defineEmits<{
  (event: 'next'): void
  (event: 'prev'): void
}>()
const { t } = useI18n()
</script>
