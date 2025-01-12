<template>
  <v-list-item
    class="gap-2"
  >
    <v-btn
      icon
      @click="onEnvVarCleared"
    >
      <v-icon>close</v-icon>
    </v-btn>
    <v-text-field
      v-model="envVarKey"
      autofocus
      label="Key"
      placeholder="Key"
      solo
      outlined
      dense
      hide-details
    />
    <v-text-field
      v-model="envVarValue"
      label="Value"
      placeholder="Value"
      solo
      outlined
      dense
      hide-details
    />
    <v-btn
      icon
      color="primary"
      @click="onEnvVarAdded"
    >
      <v-icon>check</v-icon>
    </v-btn>
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
