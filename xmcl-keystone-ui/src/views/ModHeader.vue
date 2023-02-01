<template>
  <v-card
    class="rounded-lg py-1 pr-2 z-5 shadow"
    outlined
  >
    <div
      class="flex flex-shrink flex-grow-0 items-center gap-2"
    >
      <filter-combobox
        class="pr-3 max-w-200 max-h-full"
        :label="t('mod.filter')"
      />
      <v-select
        class="max-w-40"
        hide-details
        label="Minecraft"
        flat
        solo
        clearable
      />
      <v-btn-toggle
        multiple
        dense
        :value="modLoaderFilters"
        @change="emit('update:modLoaderFilters', $event)"
      >
        <v-btn
          icon
          text
          value="forge"
        >
          <v-img
            width="28"
            :src="'image://builtin/forge'"
          />
        </v-btn>

        <v-btn
          icon
          text
          value="fabric"
        >
          <v-img
            width="28"
            :src="'image://builtin/fabric'"
          />
        </v-btn>

        <v-btn
          icon
          text
          value="quilt"
        >
          <v-img
            width="28"
            :src="'image://builtin/quilt'"
          />
        </v-btn>

        <v-btn
          icon
          text
          value="optifine"
        >
          <v-img
            width="28"
            :src="'image://builtin/optifine'"
          />
        </v-btn>
      </v-btn-toggle>
      <div class="flex-grow" />
      <v-btn
        icon
        @click="showDirectory()"
      >
        <v-icon>folder</v-icon>
      </v-btn>

      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            icon
            v-on="on"
            @click="emit('install')"
          >
            <v-icon>
              add
            </v-icon>
          </v-btn>
        </template>
      </v-tooltip>
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
import { useInstanceBase } from '../composables/instance'
import { useService } from '@/composables'
import FilterCombobox from '@/components/FilterCombobox.vue'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'

defineProps<{ modLoaderFilters: string[]; count: number }>()

const emit = defineEmits(['update:modLoaderFilters', 'install'])

const { t } = useI18n()

const { showDirectory } = useService(InstanceModsServiceKey)

const { push } = useRouter()
const { path } = useInstanceBase()
function goToCurseforgeMods() {
  push(`/curseforge/mc-mods?from=${path.value}`)
}
function goToModrinthPage() {
  push(`/modrinth?from=${path.value}`)
}

</script>
