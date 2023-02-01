<template>
  <div
    class="relative"
  >
    <v-list
      color="transparent"
    >
      <v-list-item
        v-for="r of resources"
        :key="r.path"
        @click="emit('install', r)"
      >
        <v-list-item-avatar>
          <v-img :src="r.icons ? r.icons[0] : ''" />
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title>
            {{ r.fileName }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ getExpectedSize(r.size) }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-btn icon>
            <v-icon>add</v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </div>
</template>
<script setup lang="ts">
import { useService } from '@/composables'
import { getExpectedSize } from '@/util/size'
import { ModrinthServiceKey, Resource } from '@xmcl/runtime-api'

defineProps<{
  resources: Resource[]
  loader: string
  minecraft: string
}>()

const emit = defineEmits(['install'])

const { getProjectVersions } = useService(ModrinthServiceKey)
const getMajor = (v: string) => {
  const split = v.split('.')
  if (split.length > 1) {
    return split[0] + '.' + split[1]
  }
  return v
}

</script>
