<template>
  <SettingItem :description="description">
    <template #title>
      <slot v-if="slots.title" name="title" />
      <template v-else>
        <v-icon v-if="icon" start size="small" color="primary">{{ icon }}</v-icon>
        {{ title }}
      </template>
    </template>
    <template #action="{ titleId, descriptionId }">
      <v-select
        v-model="model"
        v-bind="$attrs"
        variant="outlined"
        density="compact"
        item-title="text"
        item-value="value"
        class="setting-item-select font-weight-medium"
        hide-details
        :items="items"
        :aria-labelledby="titleId"
        :aria-describedby="description ? descriptionId : undefined"
      >
        <!-- Dropdown items -->
        <template #item="{ props, item, index }">
          <v-list-item v-bind="props" prepend-gap="0" :class="{ 'mb-1': index < items.length - 1 }">
            <template v-if="item.icon" #prepend>
              <SettingIcon :icon="item.icon" :size="24" class="mr-4" />
            </template>
          </v-list-item>
        </template>

        <!-- Selected item -->
        <template #selection="{ item }">
          <SettingIcon :icon="item.icon" :size="24" class="mr-4" />
          {{ item.text }}
        </template>
      </v-select>
    </template>
  </SettingItem>
</template>
<script setup lang="ts">
import SettingIcon from './SettingIcon.vue'
import SettingItem from './SettingItem.vue'

const { t } = useI18n()
const slots = useSlots()

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ required: true })

const props = defineProps<{
  title: string
  description?: string
  icon?: string
  /** new item will be added automatically with value set as 'default' */
  defaultItem?: string
  items: Array<{ text: string; value: string; icon?: string }>
}>()

const items = computed(() => {
  const result = [...props.items]

  if (props.defaultItem) {
    const item = result.find((v) => v.value === props.defaultItem)

    if (item) {
      result.unshift({
        text: `${item.text} (${t('shared.defaultOption')})`,
        value: 'default',
        icon: item.icon,
      })
    }
  }

  return result
})
</script>

<style scoped>
.setting-item-select {
  min-width: 200px;
  max-width: 300px;
}
</style>
