<template>
  <div
    class="flex h-full w-full select-none flex-col items-start justify-start gap-5 overflow-auto"
    style="overflow: scroll;"
  >
    <div
      v-if="instancesByTime[0].length !== 0"
      class="flex w-full flex-1 flex-grow-0 justify-center"
      style="color: grey;"
    >
      {{ t('instanceAge.today') }}
    </div>
    <v-layout
      v-if="instancesByTime[0].length !== 0"
      row
      wrap
      class="w-full items-start"
    >
      <v-flex
        v-for="instance in instancesByTime[0]"
        :key="instance.path"
        md4
        sm6
        @dragstart="emit('dragstart', instance)"
        @dragend="emit('dragend')"
      >
        <instance-card
          :instance="instance"
          @click.stop="emit('select', instance.path)"
          @delete="emit('delete', instance)"
        />
      </v-flex>
    </v-layout>

    <div
      v-if="instancesByTime[1].length !== 0"
      class="flex w-full flex-1 flex-grow-0 justify-center"
      style="color: grey"
    >
      {{ t('instanceAge.threeDay') }}
    </div>
    <v-layout
      v-if="instancesByTime[1].length !== 0"
      row
      wrap
      class="w-full items-start"
    >
      <v-flex
        v-for="instance in instancesByTime[1]"
        :key="instance.path"
        @dragstart="emit('dragstart', instance)"
        @dragend="emit('dragend')"
      >
        <instance-card
          :instance="instance"
          @click.stop="emit('select', instance.path)"
          @delete="emit('delete', instance)"
        />
      </v-flex>
    </v-layout>

    <div
      v-if="instancesByTime[2].length !== 0"
      class="flex w-full flex-1 flex-grow-0 justify-center"
      style="color: grey"
    >
      {{ t('instanceAge.older') }}
    </div>
    <v-layout
      v-if="instancesByTime[2].length !== 0"
      row
      wrap
      class="w-full items-start"
    >
      <v-flex
        v-for="instance in instancesByTime[2]"
        :key="instance.path"
        md4
        xs6
        @dragstart="emit('dragstart', instance)"
        @dragend="emit('dragend')"
      >
        <instance-card
          :instance="instance"
          @click.stop="emit('select', instance.path)"
          @delete="emit('delete', instance)"
        />
      </v-flex>
    </v-layout>
  </div>
</template>

<script lang=ts setup>
import { Instance } from '@xmcl/runtime-api'
import InstanceCard from './InstancesCard.vue'
import { Ref } from 'vue'

const props = defineProps<{ instances: Instance[] }>()
const emit = defineEmits(['select', 'dragstart', 'dragend', 'delete'])
const { t } = useI18n()
const now = Date.now()
const oneDay = 1000 * 60 * 60 * 24
const threeDays = oneDay * 3
const instancesByTime: Ref<Instance[][]> = computed(() => {
  const todayR = []
  const threeR = []
  const other = []
  for (const p of props.instances) {
    const diff = now - p.lastAccessDate
    if (diff <= oneDay) {
      todayR.push(p)
    } else if (diff <= threeDays) {
      threeR.push(p)
    } else {
      other.push(p)
    }
  }
  return [todayR, threeR, other]
})
</script>
