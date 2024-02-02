<template>
  <div
    class="v-heading w-full"
  >
    <h3 class="text-h5 my-4">
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
  .text-h5 {
    font-size: 1.4rem !important;
    font-weight: 400;
    line-height: 1.8rem;
    letter-spacing: normal !important;
    font-family: "Roboto", sans-serif;
    text-transform: none !important;
  }
</style>
