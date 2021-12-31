import Vue from 'vue'

Vue.directive('fallback-img', (el, binding) => {
  function onImageLoadFail (e: Event) {
    (e.target as HTMLImageElement).src = binding.value
  }
  el.addEventListener('error', onImageLoadFail)
})
