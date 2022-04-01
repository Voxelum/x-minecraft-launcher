<template>
  <v-card
    class="flex py-1 rounded-lg flex-shrink flex-grow-0 items-center pr-2 gap-2 z-5"
    outlined
    elevation="1"
  >
    <!-- <v-toolbar-title class="headline self-center pl-2">
        {{ $tc("mod.name", 2) }}
      </v-toolbar-title> -->
    <!-- <v-spacer /> -->
    <filter-combobox
      class="pr-3 max-w-200 max-h-full"
      :label="$t('mod.filter')"
    />
    <!-- <v-tooltip bottom>
      <template v-slot:activator="{ on }">-->
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
          @click="goToCurseforgeMods()"
        >
          <v-icon>
            $vuetify.icons.curseforge
          </v-icon>
        </v-btn>
      </template>
      {{ $t(`curseforge.mc-mods.description`) }}
    </v-tooltip>
    <v-tooltip bottom>
      <template #activator="{ on }">
        <v-btn
          icon
          v-on="on"
          @click="goToModrinthPage()"
        >
          <v-icon>
            $vuetify.icons.modrinth
          </v-icon>
        </v-btn>
      </template>
      {{ $t(`modrinth.installFrom`) }}
    </v-tooltip>
    <v-tooltip bottom>
      <template #activator="{ on }">
        <v-btn
          icon
          v-on="on"
          @click="emit('update:showCompatible', !showCompatible)"
        >
          <v-icon>
            {{
              showCompatible ? "visibility" : "visibility_off"
            }}
          </v-icon>
        </v-btn>
      </template>
      {{
        showCompatible
          ? $t("mod.showIncompatible")
          : $t("mod.hideIncompatible")
      }}
    </v-tooltip>
  </v-card>
</template>
<script lang="ts" setup>
import { useInstanceBase } from '../composables/instance'
import { useRouter, useService } from '/@/composables'
import FilterCombobox from '/@/components/FilterCombobox.vue'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'

defineProps<{ showCompatible: boolean }>()

const emit = defineEmits(['update:showCompatible'])

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
