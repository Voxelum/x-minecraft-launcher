<template>
  <div class="flex items-center justify-end gap-3">
    <v-btn
      v-shared-tooltip="_ => t('mod.showDirectory')"
      icon
      large
      @click="showDirectory(path)"
    >
      <v-icon>folder</v-icon>
    </v-btn>
    <v-menu
      bottom
      hover
      open-on-hover
      transition="slide-y-transition"
      offset-y
      origin="bottom left"
    >
      <template #activator="{ on }">
        <v-btn
          id="default-source-button"
          text
          v-on="on"
        >
          <v-icon
            v-if="defaultSource === 'curseforge'"
            :size="28"
            class="mt-0.5"
          >
            $vuetify.icons.curseforge
          </v-icon>
          <v-icon v-else>
            $vuetify.icons.modrinth
          </v-icon>
          <v-icon right>
            arrow_drop_down
          </v-icon>
        </v-btn>
      </template>
      <v-list
        dense
        nav
      >
        <v-list-item-group v-model="model">
          <v-subheader>
            {{ t('mod.switchDefaultSource') }}
          </v-subheader>
          <v-list-item key="curseforge">
            <v-list-item-icon>
              <v-icon>
                $vuetify.icons.curseforge
              </v-icon>
            </v-list-item-icon>
            <v-list-item-title>
              Curseforge
            </v-list-item-title>
          </v-list-item>
          <v-list-item key="modrinth">
            <v-list-item-icon>
              <v-icon>
                $vuetify.icons.modrinth
              </v-icon>
            </v-list-item-icon>
            <v-list-item-title>
              Modrinth
            </v-list-item-title>
          </v-list-item>
        </v-list-item-group>
      </v-list>
    </v-menu>
  </div>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceDefaultSource } from '@/composables/instanceDefaultSource'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'

const { showDirectory } = useService(InstanceModsServiceKey)
const { path, runtime: version } = injection(kInstance)
const defaultSource = injection(kInstanceDefaultSource)
const model = computed({
  get() { return defaultSource.value === 'curseforge' ? 0 : 1 },
  set(i: number) { defaultSource.value = i === 0 ? 'curseforge' : 'modrinth' },
})
const { t } = useI18n()
</script>

<style scoped>
.sun {
  opacity: 1;
}

.moon {
  opacity: 0;
}

.dark .sun {
  opacity: 0;
}

.dark .moon {
  opacity: 1;
}

.dark .VPSwitchAppearance :deep(.check) {
  /*rtl:ignore*/
  transform: translateX(28px);
}
</style>
