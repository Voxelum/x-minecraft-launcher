<template>
  <div @mouseenter="enter" @mouseleave="leave">
    <v-icon v-if="status !== 'running'" style="margin-right: 5px" :color="status === 'successed'?'green':status === 'cancelled'?'white':'red'">
      {{ icon }}
    </v-icon>
    <v-progress-circular v-else-if="total === -1 || !hovered" style="margin-right: 7px" small :size="20" :value="percentage"
                         :width="3" :indeterminate="total === -1" color="white" class="mb-0" />
    <span v-else style="margin-right: 7px">
      {{ percentage.toFixed(2) }} %
    </span>
  </div>
</template>

<script>
import { createComponent, computed } from '@vue/composition-api';

const component = createComponent({
  props: {
    status: {
      type: String,
      default: '',
    },
    progress: {
      type: Number,
      default: -1,
    },
    total: {
      type: Number,
      default: -1,
    },
    hovered: {
      type: Boolean,
      default: false,
    },
    hasChild: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const icon = computed(() => {
      switch (props.status) {
        case 'successed':
          return props.hasChild ? 'done_all' : 'check';
        case 'cancelled':
          return 'stop';
        default:
          return 'error_outline';
      }
    });
    const percentage = computed(() => props.progress / props.total * 100);
    // props.status;
    return { icon, percentage, enter() { }, leave() { } };
  },
});

export default component;
</script>

<style>
</style>
