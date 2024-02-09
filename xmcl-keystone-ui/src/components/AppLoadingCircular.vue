<template>
  <v-container>
    <v-layout
      align-center
      justify-center
      column
    >
      <div class="relative mt-8">
        <v-progress-circular
          color="primary"
          :size="70"
          :width="4"
          indeterminate
        />

        <v-progress-circular
          class="absolute left-[10px] top-[11px]"
          color="error"
          :size="50"
          :width="4"
          indeterminate
        />

        <v-progress-circular
          class="absolute left-[20px] top-[21px]"
          color="warning"
          :size="30"
          :width="4"
          indeterminate
        />
      </div>
      <v-flex class="mx-10 my-3 flex flex-col items-center justify-center gap-1">
        <VTypical
          class="blink"
          :steps="texts"
        />
        <div
          v-if="hint"
          class="text-transparent transition-all"
          :class="{ 'text-gray-500': secondaryHint }"
        >
          {{ hint + '...' }}
        </div>
      </v-flex>
    </v-layout>
  </v-container>
</template>
<script setup lang="ts">
import VTypical from '@/components/VTyping.vue'
defineProps<{
  texts: (string| number)[]
  hint?: string
  secondaryHint?: boolean
}>()
</script>
