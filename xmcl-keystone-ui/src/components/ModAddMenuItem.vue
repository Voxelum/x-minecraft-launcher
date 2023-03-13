<template>
  <v-list-item :class="{ child: child }">
    <v-list-item-action class="mr-6">
      <v-checkbox v-model="item.enabled" />
    </v-list-item-action>
    <v-list-item-avatar
      class="mr-4"
    >
      <v-img
        v-if="!child"
        :src="item.icon"
      />
      <v-icon
        v-else
        color="hsla(0,0%,100%,.7)"
      >
        subdirectory_arrow_right
      </v-icon>
    </v-list-item-avatar>
    <v-list-item-content class="py-1">
      <v-list-item-title :title="item.name">
        {{ item.name }}
      </v-list-item-title>
      <v-list-item-subtitle>
        <v-chip
          v-if="item.warning.duplicated"
          outlined
          small
          label
          color="warning"
        >
          Duplicated with {{ item.warning.duplicated }}
        </v-chip>
        <span v-else>
          {{ item.projectName ?? type }}
        </span>
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
      <v-btn
        v-if="!child"
        icon
        color="error"
        @click="emit('remove', item.id)"
      >
        <v-icon>
          delete
        </v-icon>
      </v-btn>
    </v-list-item-action>
  </v-list-item>
</template>
<script setup lang="ts">
import { ModListFileItem } from '@/composables/modInstallList'

defineProps<{
  item: ModListFileItem
  child?: boolean
  type?: string
}>()
const emit = defineEmits(['remove'])
</script>
<style scoped>
.child .v-list-item__title {
  color: hsla(0,0%,100%,.7);
}

.v-list-item__action {
  @apply my-1;
}
</style>
