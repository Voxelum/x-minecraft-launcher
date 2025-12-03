<template>
  <v-dialog
    v-model="isShown"
    width="800"
    max-width="90vw"
  >
    <v-card
      class="flex flex-col overflow-auto max-h-[90vh] visible-scroll"
    >
      <v-card-title class="flex items-center gap-2">
        <v-icon>folder</v-icon>
        {{ groupName || t('instances.folder') }}
      </v-card-title>
      <v-divider />
      <v-card-text class="overflow-auto pt-4">
        <div
          v-if="groupInstances.length === 0"
          class="flex items-center justify-center h-32 text-gray-500"
        >
          {{ t('instances.empty') }}
        </div>
        <div
          v-else
          class="grid gap-4"
          :style="{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }"
        >
          <div
            v-for="instance in groupInstances"
            :key="instance.path"
            class="flex flex-col items-center cursor-pointer rounded-lg p-2 transition-all duration-200 hover:bg-white/10 dark:hover:bg-black/20"
            @click="onSelectInstance(instance.path)"
          >
            <v-img
              :src="getIcon(instance)"
              width="64"
              height="64"
              class="rounded-lg"
            />
            <div
              class="mt-2 text-center text-sm truncate w-full"
              :title="instance.name || `Minecraft ${instance.runtime.minecraft}`"
            >
              {{ instance.name || `Minecraft ${instance.runtime.minecraft}` }}
            </div>
          </div>
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn
          text
          @click="isShown = false"
        >
          {{ t('cancel') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { kInstances } from '@/composables/instances'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { Instance } from '@xmcl/instance'
import { notNullish } from '@vueuse/core'
import { InstanceGroupData } from '@/composables/instanceGroup'

const { t } = useI18n()
const { instances: allInstances } = injection(kInstances)
const { select } = injection(kInstance)
const router = useRouter()

const groupData = ref<InstanceGroupData | null>(null)

const { isShown } = useDialog<InstanceGroupData>('folder-grid', (data) => {
  groupData.value = data
})

const groupName = computed(() => groupData.value?.name || '')

const groupInstances = computed(() => {
  if (!groupData.value) return []
  const result = groupData.value.instances
    .map(path => allInstances.value.find(i => i.path === path))
    .filter(notNullish)
  return result
})

const getIcon = (instance: Instance) => {
  return getInstanceIcon(instance, undefined)
}

const onSelectInstance = (instancePath: string) => {
  if (router.currentRoute.path !== '/') {
    router.push('/').then(() => {
      select(instancePath)
    })
  } else {
    select(instancePath)
  }
  isShown.value = false
}
</script>
