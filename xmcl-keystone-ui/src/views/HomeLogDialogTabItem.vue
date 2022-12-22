<template>
  <v-list-item
    v-ripple
    :disabled="disabled"
    @click="openFile(source.name)"
  >
    <v-list-item-avatar>
      <v-icon>clear_all</v-icon>
    </v-list-item-avatar>
    <v-list-item-content>
      <v-list-item-title>{{ source.name }}</v-list-item-title>
    </v-list-item-content>
    <v-list-item-action>
      <v-btn
        icon
        text
        @click.prevent.stop="showFile(source.name)"
      >
        <v-icon>folder</v-icon>
      </v-btn>
    </v-list-item-action>
    <v-list-item-action>
      <v-btn
        icon
        color="error"
        text
        @click.prevent.stop="removeFile(source.name)"
      >
        <v-icon>delete</v-icon>
      </v-btn>
    </v-list-item-action>
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
