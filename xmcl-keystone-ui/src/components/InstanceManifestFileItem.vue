<template>
  <div
    :style="{
      paddingLeft: `${16 + depth * 40}px`
    }"
    class="instance-manifest-file-item"
    @click.stop="$emit('toggle')"
  >
    <v-simple-checkbox
      v-if="selectable"
      :value="value"
      class="select-checkbox"
      color="success"
      @click.stop="$emit('toggleValue')"
    />
    <div
      v-if="item.children"
      class="file-collapse-btn"
      :class="{
        open
      }"
    >
      <v-icon>
        chevron_right
      </v-icon>
    </div>
    <div
      v-if="!item.children"
      class="mr-4"
    >
      <v-avatar size="24" v-if="item.avatar">
        <v-img
          :src="item.avatar"
        />
      </v-avatar>
      <v-icon v-else>
        {{ getIcon(item) }}
      </v-icon>
    </div>

    <div class="flex-grow flex flex-col justify-center">
      <div :style="{ fontSize: '16px', lineHeight: '100%', ...item.style }">
        {{ basename(item.name, '/') }}
      </div>
      <div
        v-if="description"
        :style="{
          opacity: 0.6,
          fontStyle: 'italic',
          fontSize: '12px',
        }"
      >
        {{ description }}
      </div>
      <div
        v-if="item.size > 0"
        class="inline-flex gap-2 items-center"
      >
        <span :style="{ opacity: 0.6, fontStyle: 'italic', fontSize: '12px' }">
          {{ getExpectedSize(item.size) }}
        </span>
        <v-icon
          v-if="item.modrinth"
          size="20"
        >
          $vuetify.icons.modrinth
        </v-icon>
        <v-icon
          v-if="item.curseforge"
          size="20"
        >
          $vuetify.icons.curseforge
        </v-icon>
      </div>
    </div>

    <slot :item="item" />
  </div>
</template>

<script lang="ts" setup>
import { InstanceFileNode } from '@/composables/instanceFileNodeData'
import { basename } from '@/util/basename'
import { getExpectedSize } from '@/util/size'
import { TreeItem } from '@/util/tree'

const props = defineProps<{
  item: TreeItem<InstanceFileNode<any>>
  open: boolean
  value: boolean
  description: string
  selectable?: boolean
}>()

const item = computed(() => props.item.data)
const depth = computed(() => props.item.depth)

function getIcon(file: InstanceFileNode<any>) {
  if (file.path.endsWith('.jar') || file.path.endsWith('.zip')) {
    return '$vuetify.icons.package'
  }
  return 'insert_drive_file'
}
</script>

<style>
  .file-collapse-btn {
    width: 24px;
    height: 24px;
    margin-right: 16px;
    transition: transform ease .2s;
  }

  .file-collapse-btn.open {
    transform: rotate(90deg);
  }

  .instance-manifest-file-item {
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 8px 16px;
    min-height: 48px;
    border-radius: 4px;
    transition: background-color ease .2s;
    user-select: none;
  }

  .instance-manifest-file-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .select-checkbox {
    padding-top: 0;
    margin-top: 0
  }
</style>
