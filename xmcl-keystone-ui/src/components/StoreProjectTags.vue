<template>
  <div class="">
    <v-subheader>
      {{ t('modrinth.technicalInformation') }}
    </v-subheader>
    <div class="xl:(flex flex-col) grid grid-cols-2 gap-1 px-2">
      <div
        v-for="item of project.info"
        :key="item.name"
        class="item"
      >
        <v-icon class="material-icons-outlined">
          {{ item.icon }}
        </v-icon>
        <span class="head">{{ item.name }}</span>
        <span class="flex-grow" />
        <AppCopyChip
          large
          outlined
          :value="item.value"
        />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import AppCopyChip from './AppCopyChip.vue'
import { StoreProject } from './StoreProject.vue'

defineProps<{
  project: StoreProject
}>()

const { t } = useI18n()
</script>

<style scoped>
.item {
  @apply flex items-center gap-3;
}

.item .head {
  @apply dark:text-gray-400 text-gray-600 whitespace-nowrap select-none;
}
</style>
