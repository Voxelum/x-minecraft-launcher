<template>
  <div @mouseenter="hover = true" @mouseleave="hover = false">
    <v-icon
      v-if="status !== 'running' || hover"
      style="margin-right: 5px"
      :color="color"
      @click="onClick"
    >
      {{ icon }}
    </v-icon>
    <v-progress-circular
      v-else-if="!total || total === -1 || !showNumber"
      style="margin-right: 7px"
      class="mb-0"
      color="white"
      small
      :size="20"
      :value="percentage"
      :width="3"
      :indeterminate="!total || total === -1"
    />
    <span v-else style="margin-right: 7px">{{ percentage.toFixed(2) }} %</span>
  </div>
</template>

<script lang=ts>
import { defineComponent, computed, ref } from '@vue/composition-api';
import { TaskStatus } from '@universal/task';

export interface Props {
  status: TaskStatus;
  showNumber: boolean;
  hasChild: boolean;
  uuid: string;
  progress: number;
  total: number;
  message: string;
}

const component = defineComponent<Props>({
  props: {
    status: {
      type: String,
      default: '',
    },
    showNumber: {
      type: Boolean,
      default: false,
    },
    hasChild: {
      type: Boolean,
      default: false,
    },
    uuid: {
      type: String,
    },
    progress: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: -1,
    },
    message: {
      type: String,
      default: '',
    },
  },
  setup(props, context) {
    const hover = ref(false);
    const color = computed(() => {
      switch (props.status) {
        case 'successed':
          return 'green';
        case 'cancelled':
        case 'running':
        case 'paused':
          return 'white';
        case 'failed':
          return 'red';
        default:
          return 'white';
      }
    });
    const icon = computed(() => {
      if (hover.value) {
        if (props.status === 'running') {
          return 'pause';
        }
      }
      switch (props.status) {
        case 'successed':
          return props.hasChild ? 'done_all' : 'check';
        case 'cancelled':
          return 'stop';
        case 'failed':
          return 'error_outline';
        case 'paused':
          return 'play_arrow';
        default:
          return 'device_unknown';
      }
    });
    const percentage = computed(() => props.progress! / props.total! * 100);
    const onClick = () => {
      if (props.status === 'running') {
        context.emit('pause');
      } else if (props.status === 'paused') {
        context.emit('resume');
      }
    };
    return {
      color,
      hover,
      icon,
      percentage,
      onClick,
    };
  },
});

export default component;
</script>

<style>
</style>
