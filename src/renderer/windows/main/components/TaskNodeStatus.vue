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

<script lang=ts>
import { createComponent, computed } from '@vue/composition-api';

interface Data {
  status: string;
}

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
    // props.status;
    return { icon };
  },
});

export default {
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
    const status = props.status;
    return {};
  },
  
  // computed: {
  //   icon() {
  //     switch (this.status) {
  //       case 'successed':
  //         return this.hasChild ? 'done_all' : 'check';
  //       case 'cancelled':
  //         return 'stop';
  //       default:
  //         return 'error_outline';
  //     }
  //   },
  //   percentage() {
  //     return this.progress / this.total * 100;
  //   },
  // },
  // methods: {
  //   enter() {
  //     // this.hovered = true;
  //   },
  //   leave() {
  //     // this.hovered = false;
  //   },
  // },
};
</script>

<style>
</style>
