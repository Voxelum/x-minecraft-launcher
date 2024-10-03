<template>
  <v-dialog
    v-model="isShown"
    hide-overlay
    transition="dialog-bottom-transition"
    scrollable
    width="900"
  >
    <v-card>
      <v-toolbar
        class="moveable flex-1 flex-grow-0 rounded-none"
        tabs
      >
        <v-toolbar-title class="text-white">
          {{ t('setting.migrateFromOther') }}
        </v-toolbar-title>

        <v-spacer />
        <v-btn
          class="non-moveable"
          icon
          @click="cancel"
        >
          <v-icon>arrow_drop_down</v-icon>
        </v-btn>
      </v-toolbar>
      <v-stepper v-model="step">
        <v-stepper-items class="visible-scroll overflow-y-auto">
          <v-stepper-content
            class="max-h-[70vh]"
            :step="1"
          >
            <StepSelect @select="onSelectType" />
          </v-stepper-content>
          <v-stepper-content
            class="max-h-[70vh]"
            :step="2"
          >
            <template v-if="manifest">
              <v-list
                color="transparent"
                class="overflow-auto"
              >
                <v-subheader>
                  {{ t('instanceDiscover.gameFolder', { count: activeFolders.length }) }}
                </v-subheader>
                <v-list-item
                  v-for="folder in activeFolders"
                  :key="folder"
                  @click="onEnableFolder(folder)"
                >
                  <v-list-item-avatar>
                    <v-icon>
                      folder
                    </v-icon>
                  </v-list-item-avatar>
                  <v-list-item-content>
                    <v-list-item-title>{{ basename(folder) }}</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ folder }}
                    </v-list-item-subtitle>
                  </v-list-item-content>
                  <v-list-item-action>
                    <v-checkbox
                      :value="included.includes(folder)"
                      :input-value="included.includes(folder)"
                      readonly
                      @input="onEnableFolder(folder)"
                    />
                  </v-list-item-action>
                </v-list-item>
                <v-subheader>
                  {{ t('instanceDiscover.instanceFolder', { count: manifest.instances.length }) }}
                </v-subheader>

                <InstanceItem
                  v-for="m of manifest.instances"
                  :key="m.path"
                  :value="included.includes(m.path)"
                  :runtime="m.options.runtime"
                  :name="m.options.name"
                  @select="onEnableFolder(m.path)"
                />
              </v-list>
            </template>
            <StepperFooter
              class="px-6 pb-6 pt-4"
              :disabled="false"
              :creating="false"
              create
              @quit="cancel"
              @create="onConfirm"
            >
              <div
                v-if="error"
                class="pointer-events-none absolute left-0 flex w-full justify-center"
              >
                <v-alert
                  dense
                  class="w-[50%]"
                  type="error"
                >
                  {{ errorText ?? error }}
                  <div>
                    {{ error?.path }}
                  </div>
                </v-alert>
              </div>
            </StepperFooter>
          </v-stepper-content>
        </v-stepper-items>
      </v-stepper>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import InstanceItem from '@/components/InstanceItem.vue'
import StepperFooter from '@/components/StepperFooter.vue'
import StepSelect from '@/components/StepSelect.vue'
import { useDialog } from '@/composables/dialog'
import { useService } from '@/composables/service'
import { basename } from '@/util/basename'
import { InstanceIOServiceKey, InstanceType, ThirdPartyLauncherManifest } from '@xmcl/runtime-api'

const { t } = useI18n()
const { isShown, hide: cancel } = useDialog('migrate-wizard', () => {
  step.value = 1
  error.value = undefined
  manifest.value = undefined
})

const step = ref(1)
const error = shallowRef(undefined as any)
const manifest = shallowRef(undefined as ThirdPartyLauncherManifest | undefined)
const errorText = computed(() => t('errors.BadInstanceType', {}))
const included = shallowRef([] as string[])

const { getGameDefaultPath, importLauncherData, parseLauncherData } = useService(InstanceIOServiceKey)
const onSelectType = async (type: InstanceType) => {
  const defaultPath = type === 'modrinth'
    ? await getGameDefaultPath('modrinth')
    : type === 'curseforge'
    ? await getGameDefaultPath('curseforge')
    : type === 'vanilla'
    ? await getGameDefaultPath('vanilla')
    : undefined

  const dir = await windowController.showOpenDialog({
    properties: ['openDirectory'],
    defaultPath,
  })
  if (dir.canceled) {
    return
  }
  const instancePath = dir.filePaths[0]
  const man = await parseLauncherData(instancePath, type).catch((e) => {
    error.value = e
    return undefined
  })
  manifest.value = man

  const newIncluded = [] as string[]

  if (man) {
    newIncluded.push(...man.instances.map((i) => i.path))

    if (man.folder.assets) {
      newIncluded.push(man.folder.assets)
    }
    if (man.folder.libraries) {
      newIncluded.push(man.folder.libraries)
    }
    if (man.folder.versions) {
      newIncluded.push(man.folder.versions)
    }
    if (man.folder.jre) {
      newIncluded.push(man.folder.jre)
    }
  }

  included.value = newIncluded

  if (!error.value) {
    nextTick().then(() => {
      step.value += 1
    })
  }
}

const activeFolders = computed(() => manifest.value ? Object.values(manifest.value.folder).filter(v => !!v) : [])

function onConfirm() {
  if (!manifest.value) {
    return
  }
  const man = manifest.value
  const instances = man.instances.filter((i) => included.value.includes(i.path))
  const newMan: ThirdPartyLauncherManifest = {
    instances,
    folder: {
      assets: included.value.includes(man.folder.assets) ? man.folder.assets : '',
      versions: included.value.includes(man.folder.versions) ? man.folder.versions : '',
      libraries: included.value.includes(man.folder.libraries) ? man.folder.libraries : '',
      jre: man.folder.jre && included.value.includes(man.folder.jre) ? man.folder.jre : '',
    },
  }

  cancel()

  importLauncherData(newMan)
}

function onEnableFolder(folder: string) {
  if (included.value.includes(folder)) {
    included.value = included.value.filter((i) => i !== folder)
  } else {
    included.value.push(folder)
  }
}

</script>

<style>
.v-stepper__content {
  padding: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.v-stepper__wrapper {
  display: flex;
  flex-direction: column;
}

.v-stepper__step span {
  margin-right: 12px !important;
}

.v-stepper__step div {
  display: flex !important;
}
</style>
