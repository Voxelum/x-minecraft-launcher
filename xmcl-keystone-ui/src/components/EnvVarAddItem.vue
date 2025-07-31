<template>
  <v-list-item
    class="gap-2"
  >
    <template #prepend>
      <v-btn
        icon
        variant="text"
        @click="onEnvVarCleared"
      >
        <v-icon>close</v-icon>
      </v-btn>
    </template>
    <template #title>
      <div class="flex gap-2">
        <v-text-field
          v-model="envVarKey"
          autofocus
          label="Key"
          placeholder="Key"
          variant="solo"
          density="compact"
          hide-details
        />
        <v-text-field
          v-model="envVarValue"
          label="Value"
          placeholder="Value"
          variant="solo"
          density="compact"
          hide-details
        />
      </div>
    </template>
    <template #append>
      <v-btn
        icon
        variant="text"
        color="primary"
        @click="onEnvVarAdded"
      >
        <v-icon>check</v-icon>
      </v-btn>
    </template> 
  </v-list-item>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (event: 'clear'): void
  (event: 'add', key: string, value: string): void
}>()
const envVarKey = ref('')
const envVarValue = ref('')
function onEnvVarCleared() {
  envVarKey.value = ''
  envVarValue.value = ''
  emit('clear')
}
function onEnvVarAdded() {
  emit('add', envVarKey.value, envVarValue.value)
  envVarKey.value = ''
  envVarValue.value = ''
}
</script>
