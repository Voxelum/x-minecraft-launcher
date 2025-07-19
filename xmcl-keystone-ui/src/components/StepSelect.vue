<template>
  <v-list
    color="transparent"
    class="w-200 stepper-select mx-auto flex max-h-full flex-grow-0 flex-col gap-2 overflow-auto px-2"
  >
    <v-list-item
      v-for="item of items"
      :key="item.value"
      class="rounded-lg"
      @click="emit('select', item.value)"
    >
      <template #prepend>
        <v-avatar class="self-center">
          <v-icon
            :color="item.color"
          >
            {{ item.icon }}
          </v-icon>
        </v-avatar>
      </template>

      
      <v-list-item-title>{{ item.title }}</v-list-item-title>
      <v-list-item-subtitle v-if="item.subtitle">
        {{ item.subtitle }}
      </v-list-item-subtitle>
      
      <v-list-item-action class="self-center">
        <v-icon>
          arrow_right
        </v-icon>
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>
<script setup lang="ts">

const { t } = useI18n()

const emit = defineEmits(['select'])

const items = computed(() => {
  return [/* {
    title: t('instances.addTemplate'),
    subtitle: t('instances.addTemplateDescription'),
    icon: 'apps',
    color: 'orange',
    value: 'template',
  }, {
    title: t('instances.addServer'),
    subtitle: t('instances.addServerDescription'),
    icon: 'public',
    color: 'blue',
    value: 'server',
  },  */{
    title: 'MultiMC',
    subtitle: t('instances.addMMCDescription'),
    icon: 'xmcl:mmc',
    value: 'mmc',
  }, {
    title: 'Modrinth',
    subtitle: t('instances.addModrinthDescription'),
    icon: 'xmcl:modrinth',
    value: 'modrinth',
    color: 'green',
  }, {
    title: 'CurseForge',
    subtitle: t('instances.addCurseForgeDescription'),
    icon: 'xmcl:curseforge',
    value: 'curseforge',
    color: 'red',
  }, {
    title: t('instances.addVanilla'),
    subtitle: t('instances.addVanillaDescription'),
    icon: 'xmcl:minecraft',
    value: 'vanilla',
  }, /* , {
    title: t('instances.addManually'),
    subtitle: t('instances.addDescription'),
    icon: 'add',
    value: 'manual',
  } */]
})

</script>
<style>
.stepper-select .v-list-item--link:before {
  @apply rounded-lg;
}
</style>
