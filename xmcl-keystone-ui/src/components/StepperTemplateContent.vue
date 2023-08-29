<template>
  <div class="template-content w-full">
    <v-skeleton-loader
      v-if="loading"
      type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
    />
    <v-list
      v-else
      class="min-h-[50vh] bg-transparent p-0"
      two-line
    >
      <v-list-item class="mb-2">
        <div class="flex w-full gap-3">
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
        :key="p.filePath"
        ripple
        @click="emit('select', p)"
      >
        <v-list-item-avatar>
          <v-img
            :src="p.instance.icon ? p.instance.icon : ''"
          />
        </v-list-item-avatar>

        <v-list-item-content>
          <v-list-item-title>{{ p.name }}</v-list-item-title>
          <v-list-item-subtitle class="flex gap-1">
            <v-chip
              v-if="p.instance.runtime.minecraft"
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
              {{ p.instance.runtime.minecraft }}
            </v-chip>
            <v-chip
              v-if="p.instance.runtime.forge"
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
              {{ p.instance.runtime.forge }}
            </v-chip>
            <v-chip
              v-if="p.instance.runtime.fabricLoader"
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
              {{ p.instance.runtime.fabricLoader }}
            </v-chip>
          </v-list-item-subtitle>
        </v-list-item-content>

        <v-list-item-action>
          <v-list-item-action-text>{{ p.description }}</v-list-item-action-text>
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
import { Template } from '../composables/instanceTemplates'

const props = defineProps<{
  value?: Template
  templates: Template[]
  loading: boolean
}>()

const emit = defineEmits(['select'])

const filterText = ref('')
const versionFilterOptions = computed(() => props.templates.map(v => v.instance.runtime.minecraft).filter((v): v is string => !!v))
const selectedVersionFilterOption = ref('')
const searchTextRef: Ref<null | HTMLElement> = ref(null)
const { t } = useI18n()

const items = computed(() => props.templates.filter((template) => {
  if (selectedVersionFilterOption.value) {
    if (template.instance.runtime.minecraft !== selectedVersionFilterOption.value) return false
  }
  const searching = (filterText.value ?? '').toLowerCase()
  if (searching.length === 0) {
    return true
  }
  if (template.name.toLowerCase().indexOf(searching) !== -1) {
    return true
  }
  if (template.instance.runtime.minecraft.toLowerCase().indexOf(searching) !== -1) {
    return true
  }
  if (template.instance.runtime.forge?.toLowerCase().indexOf(searching) !== -1) {
    return true
  }
  if (template.instance.runtime.fabricLoader?.toLowerCase().indexOf(searching) !== -1) {
    return true
  }
  return false
}).sort((a, b) => a.name.localeCompare(b.name)))

onUnmounted(() => {
  filterText.value = ''
})
</script>

<style>
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
../composables/instanceTemplates
