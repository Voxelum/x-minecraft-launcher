<template>
  <v-menu
    offset-x
    close-delay="200"
    content-class="sidebar-notch-group-menu"
    transition="slide-x-transition"
  >
    <template #activator="{ on, attrs }">
      <AppSideBarNotchItem
        v-bind="attrs"
        v-on="on"
        :tooltip="() => ({ text: group.name, list: instances.map(instance => instance.name || `Minecraft ${instance.runtime.minecraft}`), direction: props.direction })"
        clickable
      >
        <div class="instance-grid">
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
      <v-subheader class="pl-2">
        {{ group.name || t('instances.folder') }}
      </v-subheader>
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
import { InstanceGroupData } from '@/composables/instanceGroup'
import { kInstances } from '@/composables/instances'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { notNullish } from '@vueuse/core'
import AppSideBarNotchItem from './AppSideBarNotchItem.vue'
import AppSideBarNotchItemInstance from './AppSideBarNotchItemInstance.vue'

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
</script>

<style scoped>
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
</style>

<style>
.sidebar-notch-group-menu {
  margin-left: 8px;
}
</style>
