<template>
  <div
    class="relative w-full"
  >
    <v-list
      class="w-full"
      color="transparent"
    >
      <v-list-item
        v-for="r of resources"
        :key="r.path"
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
            <v-icon v-if="r.metadata.modrinth">
              $vuetify.icons.modrinth
            </v-icon>
            <v-icon v-if="r.metadata.curseforge">
              $vuetify.icons.curseforge
            </v-icon>
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action class="flex flex-row flex-grow-0 items-center gap-1">
          <v-avatar
            v-if="forge"
            size="30px"
          >
            <v-img
              width="28"
              :src="'image://builtin/forge'"
            />
          </v-avatar>
          <v-avatar
            v-if="fabric"
            size="30px"
          >
            <v-img
              width="28"
              :src="'image://builtin/fabric'"
            />
          </v-avatar>
          <v-avatar
            v-if="quilt"
            size="30px"
          >
            <v-img
              width="28"
              :src="'image://builtin/quilt'"
            />
          </v-avatar>
          <v-btn
            icon
            @click="emit('install', r)"
          >
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
  forge?: boolean
  fabric?: boolean
  quilt?: boolean
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
