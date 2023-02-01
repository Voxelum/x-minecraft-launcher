<template>
  <v-chip
    v-if="fabricLoader"
    label
    outlined
    @click="onClick()"
  >
    <v-avatar :left="!!fabricLoader">
      <img :src="'image://builtin/fabric'">
    </v-avatar>
    <div v-if="fabricLoader">
      Fabric
      {{ fabricLoader }}
    </div>
  </v-chip>
</template>

<script lang=ts setup>
defineProps<{
  fabricLoader: string | undefined
}>()

const onClick = () => {
}

</script>
