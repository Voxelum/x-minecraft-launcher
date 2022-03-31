<template>
  <div
    class="flex flex-col select-none overflow-auto h-full justify-start items-start w-full gap-5"
    style="overflow: scroll;"
  >
    <div
      v-if="instancesByTime[0].length !== 0"
      class="justify-center w-full flex flex-grow-0 flex-1"
      style="color: grey;"
    >
      {{ $t('profile.today') }}
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
        @dragstart="$emit('dragstart', instance)"
        @dragend="$emit('dragend')"
      >
        <instance-card
          :instance="instance"
          @click.stop="$emit('select', instance.path)"
        />
      </v-flex>
    </v-layout>

    <div
      v-if="instancesByTime[1].length !== 0"
      class="justify-center w-full flex flex-grow-0 flex-1"
      style="color: grey"
    >
      {{ $t('profile.threeDay') }}
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
        @dragstart="$emit('dragstart', instance)"
        @dragend="$emit('dragend')"
      >
        <instance-card
          :instance="instance"
          @click.stop="$emit('select', instance.path)"
        />
      </v-flex>
    </v-layout>

    <div
      v-if="instancesByTime[2].length !== 0"
      class="justify-center w-full flex flex-grow-0 flex-1"
      style="color: grey"
      xs12
    >
      {{ $t('profile.older') }}
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
        @dragstart="$emit('dragstart', instance)"
        @dragend="$emit('dragend')"
      >
        <instance-card
          :instance="instance"
          @click.stop="$emit('select', instance.path)"
        />
      </v-flex>
    </v-layout>
  </div>
</template>

<script lang=ts>
import { Ref } from '@vue/composition-api'
import { Instance } from '@xmcl/runtime-api'
import { required } from '/@/util/props'
import InstanceCard from './InstancesCard.vue'

export default defineComponent({
  components: {
    InstanceCard,
  },
  props: { instances: required<Instance[]>(Array) },
  emits: ['select'],
  setup(props) {
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
    return { instancesByTime }
  },
})
</script>
