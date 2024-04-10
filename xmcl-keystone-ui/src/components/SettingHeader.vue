<template>
  <div
    class="v-heading w-full"
  >
    <h3 class="xtext-h5 my-4">
      <slot />
    </h3>
    <v-divider />
  </div>
</template>
<style scoped>
  .v-heading {
    display: inline-block;
    top: 0;
    padding: 0 16px;
    z-index: 3;
  }
  .xtext-h5 {
    font-size: 1.4rem !important;
    font-weight: 400;
    line-height: 1.8rem;
    letter-spacing: normal !important;
    text-transform: none !important;
  }
</style>
