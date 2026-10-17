<template>
  <v-dialog
    v-model="model"
    max-width="760"
    content-class="elevation-0"
    transition="dialog-transition"
  >
    <div class="bp-subpage-card !m-0 !p-8 flex flex-col gap-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
            <v-icon size="28" color="primary">add_circle</v-icon>
          </div>
          <div>
            <h2 class="text-2xl font-black text-white tracking-wide">
              {{ t('bigPicture.newInstanceTitle') }}
            </h2>
            <p class="text-xs text-white/50">
              {{ t('bigPicture.newInstanceDesc') }}
            </p>
          </div>
        </div>

        <button
          type="button"
          class="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center transition-colors text-white/70"
          data-gamepad-focusable
          @click="model = false"
        >
          <span v-if="gamepadConnected" class="bp-glyph bp-glyph--b !mr-0">{{ buttonBLabel }}</span>
          <v-icon v-else size="20">close</v-icon>
        </button>
      </div>

      <!-- Edition Selector (Java vs Bedrock) if bedrock is supported -->
      <div v-if="bedrockSupported" class="flex flex-col gap-2">
        <div class="text-xs font-bold uppercase tracking-wider text-white/50">
          {{ t('bigPicture.editionToggle') }}
        </div>
        <div class="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-black/40 border border-white/10">
          <button
            type="button"
            class="relative flex items-center justify-center gap-3 py-3 px-5 rounded-xl transition-all duration-200 select-none cursor-pointer"
            :class="creation.data.edition === 'java'
              ? 'bg-gradient-to-r from-primary/25 to-primary/10 border-2 border-primary text-white font-bold shadow-[0_0_24px_rgba(var(--v-theme-primary),0.35)] scale-[1.01]'
              : 'bg-white/[0.04] hover:bg-white/[0.09] border border-white/5 text-white/70 font-medium'"
            data-gamepad-focusable
            @click="onSelectEdition('java')"
          >
            <img :src="BuiltinImages.minecraft" class="w-6 h-6 object-contain drop-shadow" alt="Java" />
            <span class="text-sm tracking-wide">{{ t('instances.editionJava') }}</span>
            <v-icon v-if="creation.data.edition === 'java'" size="18" color="primary" class="ml-0.5">check_circle</v-icon>
          </button>
          <button
            type="button"
            class="relative flex items-center justify-center gap-3 py-3 px-5 rounded-xl transition-all duration-200 select-none cursor-pointer"
            :class="creation.data.edition === 'bedrock'
              ? 'bg-gradient-to-r from-primary/25 to-primary/10 border-2 border-primary text-white font-bold shadow-[0_0_24px_rgba(var(--v-theme-primary),0.35)] scale-[1.01]'
              : 'bg-white/[0.04] hover:bg-white/[0.09] border border-white/5 text-white/70 font-medium'"
            data-gamepad-focusable
            @click="onSelectEdition('bedrock')"
          >
            <img :src="BuiltinImages.bedrock" class="w-6 h-6 object-contain drop-shadow" alt="Bedrock" />
            <span class="text-sm tracking-wide">{{ t('instances.editionBedrock') }}</span>
            <v-icon v-if="creation.data.edition === 'bedrock'" size="18" color="primary" class="ml-0.5">check_circle</v-icon>
          </button>
        </div>
      </div>

      <!-- Instance Name Input -->
      <div class="flex flex-col gap-2">
        <div class="text-xs font-bold uppercase tracking-wider text-white/50">
          {{ t('shared.name') }}
        </div>
        <v-text-field
          v-model="creation.data.name"
          :placeholder="placeHolderName"
          :append-inner-icon="gamepadConnected ? 'keyboard' : undefined"
          variant="outlined"
          density="comfortable"
          rounded="xl"
          hide-details
          class="bg-white/5"
          data-gamepad-focusable
          @click:append-inner="openVirtualKeyboard()"
        />
      </div>

      <!-- Mod Loader & Version Selector (Java Only) -->
      <div v-if="creation.data.edition !== 'bedrock'" class="flex flex-col gap-2">
        <ModloaderSelector
          :data="creation.data"
          :versions="localVersions"
          :show-minecraft="true"
          :show-local="false"
          auto-select-latest-on-click
        />
      </div>

      <!-- Footer Buttons -->
      <div class="flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-2">
        <button
          type="button"
          class="bp-sec-btn !px-6 !py-3"
          data-gamepad-focusable
          @click="model = false"
        >
          <span v-if="gamepadConnected" class="bp-glyph bp-glyph--b">{{ buttonBLabel }}</span>
          <span>{{ t('shared.cancel') }}</span>
        </button>

        <button
          type="button"
          class="bp-play-btn !px-8 !py-3 font-bold !min-w-[180px]"
          :disabled="creating || !creation.canCreate.value"
          data-gamepad-focusable
          @click="onCreateInstance"
        >
          <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a">{{ buttonALabel }}</span>
          <v-progress-circular
            v-if="creating"
            indeterminate
            size="20"
            width="3"
            color="white"
          />
          <v-icon v-else size="20">add</v-icon>
          <span>{{ creating ? t('bigPicture.creatingGame') : t('bigPicture.createGame') }}</span>
        </button>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BuiltinImages } from '@/constant'
import ModloaderSelector from '@/components/ModloaderSelector.vue'
import { useGamepad } from '@/composables/gamepad'
import { useBigPicture } from '@/composables/bigPicture'
import { useNotifier } from '@/composables/notifier'
import { useService } from '@/composables'
import { injection } from '@/util/inject'
import { kUserContext } from '@/composables/user'
import { kInstances } from '@/composables/instances'
import { kInstance } from '@/composables/instance'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { useInstanceCreation } from '@/composables/instanceCreation'
import { useHasMinecraftLicense } from '@/composables/minecraftLicense'
import { useMinecraftVersions } from '@/composables/version'
import { kLocalVersions } from '@/composables/versionLocal'
import { BedrockServiceKey } from '@xmcl/runtime-api'

type InstanceEdition = 'java' | 'bedrock'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const { t } = useI18n()
const { notify } = useNotifier()
const { openVirtualKeyboard } = useBigPicture()
const gamepad = useGamepad()
const gamepadConnected = gamepad.connected
const buttonALabel = gamepad.buttonA
const buttonBLabel = gamepad.buttonB

const { gameProfile } = injection(kUserContext)
const { instances } = injection(kInstances)
const { path: currentPath, select } = injection(kInstance)
const { fix } = injection(kInstanceVersionInstall)
const { versions: localVersions } = injection(kLocalVersions)

const creation = useInstanceCreation(gameProfile, instances)
const { placeHolderName } = creation

const { getInstallation, install: installBedrock, isSupported } = useService(BedrockServiceKey)
const bedrockSupported = ref(false)
isSupported().then((v) => { bedrockSupported.value = v }).catch(() => { bedrockSupported.value = false })
const { hasMinecraftLicense } = useHasMinecraftLicense()

// Editions
function onSelectEdition(edition: InstanceEdition) {
  creation.data.edition = edition
  if (edition === 'bedrock') {
    creation.data.name = 'Bedrock'
  } else if (creation.data.name === 'Bedrock') {
    creation.data.name = ''
  }
}

// Minecraft Versions
const { versions: allMinecraftVersions, release: latestRelease } = useMinecraftVersions()

watch(latestRelease, (rel) => {
  if (rel && !creation.data.runtime.minecraft) {
    creation.data.runtime.minecraft = rel.id
  }
}, { immediate: true })

// Creation
const creating = ref(false)

async function onCreateInstance() {
  if (creating.value) return
  const isBedrock = creation.data.edition === 'bedrock'
  if (isBedrock && !hasMinecraftLicense.value) {
    notify({
      level: 'error',
      title: t('bedrock.installFailed'),
      body: t('bedrock.licenseRequired'),
    })
    return
  }

  creating.value = true
  try {
    const newPath = await creation.create((path) => {
      select(path)
      currentPath.value = path
      model.value = false
    })

    if (newPath) {
      select(newPath)
      currentPath.value = newPath
      model.value = false

      if (isBedrock) {
        try {
          const instStatus = await getInstallation()
          if (!instStatus.installed) {
            installBedrock().catch((err) => console.error('Failed to auto install Bedrock:', err))
          }
        } catch (e) {
          console.error(e)
        }
      } else {
        await fix().catch(() => {})
      }
      notify({
        level: 'success',
        title: t('bigPicture.installedSuccess', { title: creation.data.name || placeHolderName.value }),
      })
      creation.reset()
    }
  } catch (err: any) {
    notify({
      level: 'error',
      title: 'Failed to create instance',
      body: err?.message,
    })
  } finally {
    creating.value = false
  }
}

watch(model, (open) => {
  if (open) {
    creation.reset()
    if (latestRelease.value) {
      creation.data.runtime.minecraft = latestRelease.value.id
    }
  }
})
</script>
