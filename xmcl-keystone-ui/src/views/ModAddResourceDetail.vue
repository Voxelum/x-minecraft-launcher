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
          <v-btn
            icon
            text
            @click="showFile(r)"
          >
            <v-icon>
              folder
            </v-icon>
          </v-btn>
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
            :disabled="isInstalled(r)"
            icon
            @click="emit('install', r)"
          >
            <v-icon>
              {{ installed ? 'swap_horiz' : 'add' }}
            </v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </div>
</template>
<script setup lang="ts">
import { useService } from '@/composables'
import { getExpectedSize } from '@/util/size'
import { BaseServiceKey, Resource } from '@xmcl/runtime-api'

const props = defineProps<{
  resources: Resource[]
  installed: Resource | undefined
  loader: string
  minecraft: string
  forge?: boolean
  fabric?: boolean
  quilt?: boolean
}>()

const emit = defineEmits(['install'])

const isInstalled = (r: Resource) => {
  return props.installed?.storedPath === r.path || props.installed?.path === r.path || props.installed?.path === r.storedPath || props.installed?.ino === r.ino
}

const { showItemInDirectory } = useService(BaseServiceKey)
const showFile = (r: Resource) => {
  showItemInDirectory(r.path)
}

</script>
