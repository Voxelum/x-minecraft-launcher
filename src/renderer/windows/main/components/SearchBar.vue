<template>
  <transition name="scale-transition">
    <v-text-field
      v-show="show"
      ref="self"
      v-model="text"
      style="position: fixed; z-index: 2;"
      :style="{ top: `${top}px`, right: `${right}px` }"
      solo
      append-icon="filter_list"
      @focus="focused = true"
      @blur="focused = false"
      @keyup.esc="show = false"
    />
  </transition>
</template>

<script lang=ts>
import { defineComponent, inject, ref, onMounted, onUnmounted, Ref, nextTick } from '@/vue';
import { useSearch, useSearchToggle } from '../hooks';

export default defineComponent({
  setup() {
    const show = ref(false);
    const { text } = useSearch();
    const { toggle } = useSearchToggle();
    const top = inject('search-top', ref(30));
    const right = inject('search-right', ref(30));
    const focused = ref(false);
    const self: Ref<any> = ref(null);
    function toggleBar(force?: boolean) {
      if (force) {
        show.value = false;
        return;
      }
      if (show.value && !focused.value) {
        nextTick(() => {
          self.value.focus();
        });
      } else {
        show.value = !show.value;
        nextTick(() => {
          self.value.focus();
        });
      }
    }
    onMounted(() => {
      toggle.value.unshift(toggleBar);
    });
    onUnmounted(() => {
      toggle.value.shift();
    });
    return {
      show,
      focused,
      self,
      text,
      top,
      right,
    };
  },
});
</script>

<style>
</style>
