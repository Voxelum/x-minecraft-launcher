<template>
  <v-card
    class="z-5 rounded-lg py-1 pr-2 shadow"
    outlined
  >
    <div
      class="flex flex-shrink flex-grow-0 items-center gap-2"
    >
      <div class="flex-grow" />
      <!-- <filter-combobox
        class="pr-3 max-w-200 max-h-full"
        :label="t('mod.filter')"
      /> -->
      <v-btn
        icon
        @click="showDirectory(path)"
      >
        <v-icon>folder</v-icon>
      </v-btn>

      <v-btn
        large
        color="primary"
        @click="emit('install')"
      >
        Add
        <v-icon right>
          add
        </v-icon>
      </v-btn>
    </div>
    <div
      class="flex flex-shrink flex-grow-0 items-center justify-center gap-2"
    >
      <v-card-subtitle class="p-0 pt-2">
        {{ t('mod.enabled', { count }) }}
      </v-card-subtitle>
    </div>
  </v-card>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'

defineProps<{ count?: number }>()

const emit = defineEmits(['update:modLoaderFilters', 'install'])

const { t } = useI18n()

const { showDirectory } = useService(InstanceModsServiceKey)

const { path } = injection(kInstance)

</script>
