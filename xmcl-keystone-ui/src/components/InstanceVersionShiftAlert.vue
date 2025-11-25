<template>
  <v-alert
    v-if="loaderDifferences.old.length > 0 || loaderDifferences.new.length > 0"
    colored-border
    outlined
    type="error"
    color="error"
  >
    <i18n-t
      tag="p"
      keypath="instanceUpdate.loaderChanged"
    >
      <template #modloader>
        <v-chip
          label
          small
          outlined
        >
          {{ loaderDifferences.old.join(', ') }}
        </v-chip>
      </template>
      <template #newModloader>
        <v-chip
          label
          small
          outlined
        >
          {{ loaderDifferences.new.join(', ') }}
        </v-chip>
      </template>
    </i18n-t>
  </v-alert>
</template>
<script lang="ts" setup>

const props = defineProps<{
  oldRuntime: Record<string, any>
  runtime: Record<string, any>
}>()

const loaderDifferences = computed(() => {
  const old = props.oldRuntime
  const newR = props.runtime
  const loaders = ['forge', 'fabricLoader', 'quiltLoader', 'neoForged']
  const oldL = [] as string[]
  const newL = [] as string[]
  for (const l of loaders) {
    if (!!old[l] !== !!newR[l]) {
      if (old[l]) {
        oldL.push(l)
      } else {
        newL.push(l)
      }
    }
  }
  return {
    old: oldL,
    new: newL,
  }
})

</script>