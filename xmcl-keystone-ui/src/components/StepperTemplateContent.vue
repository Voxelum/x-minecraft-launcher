<template>
  <div class="template-content w-full">
    <v-list
      style="background: transparent"
      class="p-0"
      two-line
    >
      <v-list-item class="mb-2">
        <div class="flex gap-3 w-full">
          <v-select
            v-model="selectedVersionFilterOption"
            class="max-w-40"
            hide-details
            label="Minecraft"
            :items="versionFilterOptions"
            clearable
          />
          <v-spacer />
          <v-text-field
            ref="searchTextRef"
            v-model="filterText"
            hide-details
            filled
            append-icon="filter_list"
            :label="t('filter')"
          />
        </div>
      </v-list-item>
      <v-divider />
      <v-list-item
        v-for="p in items"
        :key="p.id"
        ripple
        @click="emit('select', p)"
      >
        <v-list-item-avatar>
          <v-img
            :src="p.icon ? p.icon : ''"
          />
        </v-list-item-avatar>

        <v-list-item-content>
          <v-list-item-title>{{ p.name }}</v-list-item-title>
          <v-list-item-subtitle class="flex gap-1">
            <v-chip
              v-if="p.runtime.minecraft"
              outlined
              small
              label
            >
              <v-avatar left>
                <img
                  :src="'image://builtin/minecraft'"
                  alt="minecraft"
                >
              </v-avatar>
              {{ p.runtime.minecraft }}
            </v-chip>
            <v-chip
              v-if="p.runtime.forge"
              outlined
              small
              label
            >
              <v-avatar left>
                <img
                  :src="'image://builtin/forge'"
                  alt="forge"
                >
              </v-avatar>
              {{ p.runtime.forge }}
            </v-chip>
            <v-chip
              v-if="p.runtime.fabricLoader"
              outlined
              small
              label
            >
              <v-avatar left>
                <img
                  :src="'image://builtin/fabric'"
                  alt="fabric"
                >
              </v-avatar>
              {{ p.runtime.fabricLoader }}
            </v-chip>
          </v-list-item-subtitle>
        </v-list-item-content>

        <v-list-item-action>
          <v-list-item-action-text>{{ getActionText(p) }}</v-list-item-action-text>
        </v-list-item-action>
        <v-list-item-action>
          <v-checkbox
            :value="value === p"
            readonly
          />
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </div>
</template>

<script lang=ts setup>
import { Ref } from 'vue'
import { Template } from '../composables/instanceAdd'

const props = defineProps<{
  value?: Template
  templates: Template[]
}>()

const emit = defineEmits(['select'])

const filterText = ref('')
const versionFilterOptions = computed(() => props.templates.map(v => v.runtime.minecraft).filter((v): v is string => !!v))
const selectedVersionFilterOption = ref('')
const searchTextRef: Ref<null | HTMLElement> = ref(null)
const { t } = useI18n()

const getActionText = (template: Template) => {
  if (template.source.type === 'instance') {
    return template.source.instance.server ? t('instanceTemplate.server') : t('instanceTemplate.profile')
  }
  if (template.source.type === 'mcbbs') return t('instanceTemplate.mcbbs')
  if (template.source.type === 'curseforge') return t('instanceTemplate.curseforge')
  if (template.source.type === 'modrinth') return t('instanceTemplate.modrinth')
  if (template.source.type === 'ftb') return t('instanceTemplate.ftb')
  return t('instanceTemplate.modpack')
}

const items = computed(() => props.templates.filter((template) => {
  if (selectedVersionFilterOption.value) {
    if (template.runtime.minecraft !== selectedVersionFilterOption.value) return false
  }
  const searching = (filterText.value ?? '').toLowerCase()
  if (searching.length === 0) {
    return true
  }
  if (template.name.toLowerCase().indexOf(searching) !== -1) {
    return true
  }
  if (template.runtime.minecraft.toLowerCase().indexOf(searching) !== -1) {
    return true
  }
  if (template.runtime.forge.toLowerCase().indexOf(searching) !== -1) {
    return true
  }
  if (template.runtime.fabricLoader.toLowerCase().indexOf(searching) !== -1) {
    return true
  }
  return false
}).sort((a, b) => a.name.localeCompare(b.name)))

onUnmounted(() => {
  filterText.value = ''
})
</script>

<style >
.java-select .v-select__selection {
  white-space: nowrap;
  overflow-x: hidden;
  overflow-y: hidden;

  max-width: 240px;
}
.v-stepper__step span {
  margin-right: 12px !important;
}
.v-stepper__step div {
  display: flex !important;
}

.template-content
  .theme--.v-text-field
  > .v-input__control
  > .v-input__slot:before {
  border: none;
}
</style>
