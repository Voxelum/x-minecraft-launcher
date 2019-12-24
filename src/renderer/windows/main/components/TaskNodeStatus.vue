<template>
  <div @mouseenter="enter" @mouseleave="leave">
    <v-icon v-if="status !== 'running'" style="margin-right: 5px" :color="status === 'successed'?'green':status === 'cancelled'?'white':'red'">
      {{ icon }}
    </v-icon>
    <v-progress-circular v-else-if="!total || total === -1 || !hovered" style="margin-right: 7px" small :size="20" :value="percentage"
                         :width="3" :indeterminate="!total || total === -1" color="white" class="mb-0" />
    <span v-else style="margin-right: 7px">
      {{ percentage.toFixed(2) }} %
    </span>
  </div>
</template>

<script lang=ts>
import { createComponent, computed } from '@vue/composition-api';
import { useStore } from '@/hooks';

const component = createComponent({
  props: {
    status: {
      type: String,
      default: '',
    },
    hovered: {
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
  setup(props) {
    const icon = computed(() => {
      switch (props.status) {
        case 'successed':
          return props.hasChild ? 'done_all' : 'check';
        case 'cancelled':
          return 'stop';
        case 'failed':
          return 'error_outline';
        default:
          return 'device_unknown';
      }
    });
    // const { state } = useStore();
    // const total = computed(() => state.task.tree[props.uuid!].total!);
    const percentage = computed(() => props.progress! / props.total! * 100);
    return {
      icon,
      percentage,
      // total,
      enter() { },
      leave() { },
    };
  },
});

export default component;
</script>

<style>
</style>
