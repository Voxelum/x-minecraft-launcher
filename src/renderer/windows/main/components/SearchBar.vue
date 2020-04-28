<template>
  <transition name="scale-transition">
    <v-text-field
      v-show="show"
      ref="self"
      v-model="text"
      style="position: fixed; z-index: 2; right: 30px"
      solo
      append-icon="filter_list"
      @focus="focused = true"
      @blur="focused = false"
      @keyup.esc="show = false"
    />
  </transition>
</template>

<script lang=ts>
import Vue from 'vue';
import { createComponent, inject, ref, onMounted, onUnmounted, Ref } from '@vue/composition-api';

export default createComponent({
  setup() {
    const show = inject('search-bar-shown', ref(false));
    const text = inject('search-text', ref(''));
    const focused = ref(false);
    const self: Ref<any> = ref(null);
    function handleKeydown(e: KeyboardEvent) {
      if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
        if (show.value && !focused.value) {
          Vue.nextTick(() => {
            self.value.focus();
          });
        } else {
          show.value = !show.value;
          Vue.nextTick(() => {
            self.value.focus();
          });
        }
      }
    }
    function handleKeyup(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        show.value = false;
      }
    }
    onMounted(() => {
      document.addEventListener('keyup', handleKeyup);
      document.addEventListener('keydown', handleKeydown);
    });
    onUnmounted(() => {
      document.addEventListener('keyup', handleKeyup);
      document.addEventListener('keydown', handleKeydown);
    });
    return {
      show,
      focused,
      self,
      text,
      handleKeyup,
    };
  },
});
</script>

<style>
</style>
