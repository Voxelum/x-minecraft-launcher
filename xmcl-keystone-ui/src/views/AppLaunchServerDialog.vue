<template>
  <v-dialog
    :value="isShown"
    width="600"
  >
    <v-card class="select-none overflow-auto flex flex-col">
      <v-toolbar
        class="flex-1 flex-grow-0 rounded-none"
        tabs
        color="green en"
      >
        <v-toolbar-title class="text-white">
          {{ t('instance.launchServer') }}
        </v-toolbar-title>

        <v-spacer />
        <v-btn
          class="non-moveable"
          icon
          @click="isShown = false"
        >
          <v-icon>arrow_drop_down</v-icon>
        </v-btn>
      </v-toolbar>
      <div
        class="visible-scroll flex flex-col max-h-[600px] mx-0  overflow-y-auto overflow-x-hidden px-6 py-2"
      >
        <v-subheader>{{ t('save.name') }}</v-subheader>
        <v-item-group mandatory>
          <div class="grid grid-cols-3 gap-2 max-h-40 overflow-auto">
            <v-item v-slot="{ active, toggle }">
              <v-card
                :color="active ? 'primary' : ''"
                class="flex flex-col items-center justify-center h-[120px]"
                @click="toggle"
              >
                <v-icon size="80">
                  add
                </v-icon>
                Create New
              </v-card>
            </v-item>
            <v-item
              v-for="s of saves"
              :key="s.path"
              v-slot="{ active, toggle }"
            >
              <v-card
                :color="active ? 'primary' : ''"
                class="flex flex-col items-center justify-center"
                @click="toggle"
              >
                <img
                  v-fallback-img="unknownPack"
                  class="rounded-lg object-contain"
                  :src="s.icon"
                  width="80px"
                  height="80px"
                >
                {{ s.name }}
              </v-card>
            </v-item>
          </div>
        </v-item-group>

        <v-subheader>{{ t('mod.name') }}</v-subheader>
        <div>
          <v-list
            dense
            class="max-h-80 overflow-auto"
          >
            <v-list-item
              v-for="m of enabled"
              :key="m.path"
            >
              <v-list-item-avatar :size="30">
                <img
                  ref="iconImage"
                  :src="m.icon || unknownPack"
                >
              </v-list-item-avatar>
              <v-list-item-title class="flex overflow-hidden">
                {{ m.name }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </div>
        <div class="flex items-center">
          <i18n-t
            keypath="eula.body"
            tag="p"
          >
            <template #accept>
              <v-chip
                color="primary"
                label
                class="mx-2"
                small
              >
                {{ t('shared.accept') }}
              </v-chip>
            </template>
            <template #eula>
              <a
                href="https://aka.ms/MinecraftEULA"
                target="_blank"
              >EULA</a>
            </template>
          </i18n-t>
          <div class="flex-grow" />
          <v-checkbox />
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>
<script lang="ts" setup>
import { useDialog, useSimpleDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { kInstanceSave } from '@/composables/save'
import { useService } from '@/composables/service'
import { injection } from '@/util/inject'
import { InstanceOptionsServiceKey } from '@xmcl/runtime-api'
import unknownPack from '@/assets/unknown_pack.png'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { vFallbackImg } from '@/directives/fallbackImage'

defineProps<{ }>()

const { isShown } = useDialog('launch-server')
const { t } = useI18n()

watch(isShown, (value) => {
  console.log(value)
})

const { getEULA, setEULA } = useService(InstanceOptionsServiceKey)
const { runtime, path } = injection(kInstance)
const { saves } = injection(kInstanceSave)
const { mods } = injection(kInstanceModsContext)
const enabled = computed(() => mods.value.filter(m => m.enabled))

async function onAcceptEULA() {
  await setEULA(path.value, true)
}

</script>
