<template>
  <div
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <v-icon
      v-if="item.state !== 1 || hover"
      style="margin-right: 5px"
      :color="color"
      @click="onClick"
    >
      {{ icon }}
    </v-icon>
    <v-progress-circular
      v-else-if="indeterminate || !showNumber"
      style="margin-right: 7px"
      class="mb-0"
      color="white"
      small
      :size="20"
      :value="percentage"
      :width="3"
      :indeterminate="indeterminate"
    />
    <span
      v-else
      style="margin-right: 7px"
    >{{ percentage.toFixed(2) }} %</span>
  </div>
</template>

<script lang=ts>
import { TaskItem } from '/@/entities/task'
import { required } from '/@/util/props'
import { defineComponent, computed, ref } from '@vue/composition-api'
import { TaskState } from '/@shared/task'

export default defineComponent({
  props: {
    item: required<TaskItem>(Object),
    showNumber: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, context) {
    const hover = ref(false)
    const color = computed(() => {
      switch (props.item.state) {
        case TaskState.Successed:
          return 'green'
        case TaskState.Cancelled:
        case TaskState.Running:
        case TaskState.Paused:
          return 'white'
        case TaskState.Failed:
          return 'red'
        default:
          return 'white'
      }
    })
    const indeterminate = computed(() => !props.item.total || props.item.total === -1)
    const icon = computed(() => {
      if (hover.value) {
        if (props.item.state === TaskState.Running) {
          return 'pause'
        }
      }
      switch (props.item.state) {
        case TaskState.Successed:
          return props.item.children && props.item.children.length > 0 ? 'done_all' : 'check'
        case TaskState.Cancelled:
          return 'stop'
        case TaskState.Failed:
          return 'error_outline'
        case TaskState.Paused:
          return 'play_arrow'
        default:
          return 'device_unknown'
      }
    })
    const percentage = computed(() => props.item.progress! / props.item.total! * 100)
    const onClick = () => {
      if (props.item.state === TaskState.Running) {
        context.emit('pause')
      } else if (props.item.state === TaskState.Paused) {
        context.emit('resume')
      }
    }
    return {
      indeterminate,
      color,
      hover,
      icon,
      percentage,
      onClick,
    }
  },
})
</script>

<style>
</style>
