<template>
  <v-menu
    offset-x
    close-delay="200"
    content-class="sidebar-notch-group-menu"
    transition="slide-x-transition"
  >
    <template #activator="{ props }">
      <AppSideBarNotchItem
        v-bind="props"
        :tooltip="() => ({ text: group.name, list: instances.map(instance => instance.name || `Minecraft ${instance.runtime.minecraft}`), direction: props.direction })"
        clickable
      >
        <div v-if="group.icon" class="instance-custom-icon">
          <img
            v-if="isImageUrl(group.icon)"
            class="instance-custom-img"
            :src="group.icon"
          >
          <v-icon
            v-else
            size="22"
            :color="group.color ? 'white' : 'primary'"
            class="group-folder-icon"
          >
            {{ group.icon }}
          </v-icon>
        </div>
        <div v-else class="instance-grid">
          <img
            v-for="i in instances.slice(0, 4)"
            :key="i.path"
            class="instance-grid-item"
            :src="getInstanceIcon(i, i.server ? undefined : undefined)"
          >
        </div>
      </AppSideBarNotchItem>
    </template>

    <v-card class="rounded-lg elevation-4 p-2" outlined>
      <v-list-subheader class="pl-2">
        {{ group.name || t('instances.folder') }}
      </v-list-subheader>
      <div class="grid grid-cols-2 gap-2 items-center justify-center">
        <AppSideBarNotchItemInstance
          v-for="(instance, index) in group.instances"
          :key="instance + index"
          :path="instance"
          :direction="direction"
        />
      </div>
    </v-card>
  </v-menu>
</template>

<script lang="ts" setup>
import { kInstances } from '@/composables/instances'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { notNullish } from '@vueuse/core'
import AppSideBarNotchItem from './AppSideBarNotchItem.vue'
import AppSideBarNotchItemInstance from './AppSideBarNotchItemInstance.vue'
import { InstanceGroupData } from '@xmcl/runtime-api'

const props = defineProps<{
  group: InstanceGroupData
  direction?: 'top' | 'bottom' | 'left' | 'right'
}>()

const { t } = useI18n()
const { instances: allInstances } = injection(kInstances)

const instances = computed(() => {
  return props.group.instances
    .map(path => allInstances.value.find(i => i.path === path))
    .filter(notNullish)
})

function isImageUrl(val?: string): boolean {
  if (!val) return false
  return val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/') || val.startsWith('image://')
}

function isGradient(val?: string): boolean {
  if (!val) return false
  return val.includes('gradient')
}
</script>

<style scoped>
.instance-custom-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.instance-custom-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.instance-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 1px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
}

.instance-grid-item {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-folder-icon {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
}

.group-folder-icon :deep(img) {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6)) brightness(1.2) contrast(1.1);
}
</style>

<style>
.sidebar-notch-group-menu {
  margin-left: 8px;
}
</style>
