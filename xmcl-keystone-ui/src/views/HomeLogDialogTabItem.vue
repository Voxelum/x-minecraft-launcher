<template>
  <v-list-item
    v-ripple
    :disabled="disabled"
    :title="source.name"
    @click="openFile(source.name)"
  >
    <template #prepend>
      <v-avatar>
        <v-icon>clear_all</v-icon>
      </v-avatar>
    </template>
    
    <template #append>
      <v-list-item-action>
        <v-btn
          icon
          variant="text"
          @click.prevent.stop="showFile(source.name)"
        >
          <v-icon>folder</v-icon>
        </v-btn>
      </v-list-item-action>
      <v-list-item-action>
        <v-btn
          icon
          color="error"
          variant="text"
          @click.prevent.stop="removeFile(source.name)"
        >
          <v-icon>delete</v-icon>
        </v-btn>
      </v-list-item-action>
    </template>
  </v-list-item>
</template>

<script lang=ts setup>

defineProps<{
  source: { name: string; id: string }
  disabled: boolean
  removeFile(file: string): Promise<void>
  showFile(file: string): void
  openFile(file: string): void
}>()
</script>
