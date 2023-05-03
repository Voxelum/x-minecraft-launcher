<template>
  <v-list-item
    :class="{ child: child }"
    :disabled="disabled"
  >
    <v-list-item-action class="mr-6">
      <v-checkbox
        v-if="!item.remove"
        v-model="item.enabled"
      />
    </v-list-item-action>
    <v-list-item-avatar
      class="mr-4"
    >
      <v-img
        v-if="!child"
        :src="item.icon"
      />
      <v-icon
        v-else
        color="hsla(0,0%,100%,.7)"
      >
        subdirectory_arrow_right
      </v-icon>
    </v-list-item-avatar>
    <v-list-item-content
      class="py-1"
      :class="{ removal: item.remove }"
    >
      <v-list-item-title
        :title="item.name"
      >
        {{ item.name }}
      </v-list-item-title>
      <v-list-item-subtitle>
        <template
          v-if="item.warnings.length > 0"
        >
          <v-chip
            v-for="warning in item.warnings"
            :key="warning.target"
            outlined
            small
            label
            color="warning"
          >
            Duplicated with {{ warning.target }}
          </v-chip>
        </template>
        <span v-else>
          {{ depType }}
        </span>
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
      <v-btn
        v-if="!child"
        icon
        :disabled="disabled"
        color="error"
        @click="emit('remove', item.id)"
      >
        <v-icon>
          {{ item.remove ? 'close' : 'delete' }}
        </v-icon>
      </v-btn>
    </v-list-item-action>
  </v-list-item>
</template>
<script setup lang="ts">
import { InstallListFileItem } from '@/composables/installList.js'

const props = defineProps<{
  item: InstallListFileItem
  child?: boolean
  disabled?: boolean
  type?: 'incompatible' | 'required' | 'optional' | 'embedded'
}>()
const emit = defineEmits(['remove'])
const { t } = useI18n()
const depType = computed(() => props.type === 'embedded'
  ? t('dependencies.embedded')
  : props.type === 'incompatible'
    ? t('dependencies.incompatible')
    : props.type === 'required'
      ? t('dependencies.required')
      : props.type === 'optional' ? t('dependencies.optional') : props.item.projectName)
</script>
<style scoped>
.child .v-list-item__title {
  color: hsla(0,0%,100%,.7);
}

.v-list-item__action {
  @apply my-1;
}

.removal {
  @apply line-through text-red-500;
}
</style>
