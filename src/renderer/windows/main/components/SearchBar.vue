<template>
  <transition name="scale-transition">
    <v-text-field v-show="show" 
                  ref="self" 
                  v-model="text" 
                  style="position: fixed; z-index: 2; right: 30px" 
                  solo
                  append-icon="filter_list" 
                  @focus="focused=true" 
                  @blur="focused=false"
                  @keyup="handleKeyup" />
  </transition>
</template>

<script>
import Vue from 'vue';
import { createComponent, inject, ref, onMounted, onUnmounted } from '@vue/composition-api';

export default createComponent({
  setup() {
    const show = inject('search-bar-shown', ref(false));
    const text = inject('search-text', ref(''));
    const focused = ref(false);
    const self = ref(null);
    function handleKeydown(e) {
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
    function handleKeyup(e) {
      if (e.code === 'Escape') {
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
    };
  },
});
</script>

<style>
</style>
