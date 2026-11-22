<template>
  <div class="flex flex-col gap-4">
    <!-- Java Memory Settings Card -->
    <SettingCard :title="t('java.memory')" icon="memory">
      <div class="d-flex align-center mb-3">
        <span class="font-weight-medium mr-3">{{ t('setting.memoryAssignment') }}</span>
        <v-spacer />
        <SettingJavaMemoryAssign :value="assignMemory" @input="assignMemory = $event" />
      </div>
      <SettingJavaMemory :assign-memory="assignMemory" v-model:min="minMem" v-model:max="maxMem" />
    </SettingCard>

    <!-- Java Profiles Card -->
    <SettingCard :title="t('setting.javaProfiles')" icon="dns">
      <!-- Java Preference -->
      <div class="flex flex-wrap items-center gap-3">
        <v-avatar
          size="40"
          rounded="lg"
          :color="preferredJava && preferredJava.valid ? 'primary' : 'surface-variant'"
          :variant="preferredJava && preferredJava.valid ? 'flat' : 'tonal'"
        >
          <span
            v-if="preferredJava && preferredJava.valid && preferredJava.majorVersion"
            class="text-subtitle-1 font-weight-bold"
          >
            {{ preferredJava.majorVersion }}
          </span>
          <v-icon v-else>smart_toy</v-icon>
        </v-avatar>
        <div class="flex-1 min-w-[160px]">
          <div class="text-subtitle-2 font-weight-medium">
            {{ t('setting.globalJava') }}
          </div>
          <div
            v-if="preferredJava && preferredJava.valid"
            class="text-caption text-medium-emphasis truncate"
          >
            Java {{ preferredJava.version }} — {{ preferredJava.path }}
          </div>
          <div v-else class="text-caption text-medium-emphasis">
            {{ t('setting.globalJavaHint') }}
          </div>
        </div>

        <JavaActions @added="javaPickerOpen = true" />

        <v-btn variant="tonal" color="primary" @click="showInstaller">
          <v-icon start>archive</v-icon>
          {{ t('setting.installJava') }}
        </v-btn>

        <v-menu v-model="javaPickerOpen" :close-on-content-click="false" location="bottom end">
          <template #activator="{ props: menuProps }">
            <v-btn v-bind="menuProps" variant="tonal">
              <v-icon start>tune</v-icon>
              {{ t('java.change') }}
            </v-btn>
          </template>
          <v-card width="540" max-width="90vw" max-height="60vh" class="overflow-auto">
            <JavaList
              :value="preferredJava || emptyJava"
              :items="javas"
              :remove="onRemoveJava"
              @input="onPickJava"
            />
          </v-card>
        </v-menu>
      </div>

      <v-divider class="my-4" />

      <!-- Java Vendor Preference -->
      <SettingItemSelect
        v-model="preferredVendor"
        :title="t('setting.javaInstaller.preferredVendor')"
        :description="t('setting.javaInstaller.preferredVendorDescription')"
        :default-item="defaultPreferredJavaVendor"
        :items="vendors"
      />

      <v-divider class="mt-4 mb-1" />

      <!-- Installed Java Profiles -->
      <v-list class="overflow-y-auto" max-height="1050">
        <div
          v-for="(item, index) in javas"
          :key="item.path"
          class="java-profile-item"
          :class="{ 'has-divider': index !== javas.length - 1 }"
        >
          <v-list-item class="mt-4" :color="item.valid ? 'primary' : 'error'">
            <template #prepend>
              <v-avatar
                rounded="lg"
                :color="item.valid ? 'primary' : 'orange'"
                :variant="item.valid ? 'flat' : 'tonal'"
              >
                <span class="font-weight-bold">
                  {{ item.majorVersion || '?' }}
                </span>
              </v-avatar>
            </template>

            <v-list-item-title v-if="item.valid" class="flex items-center gap-2">
              Java {{ item.version }}
              <v-chip
                v-if="item.arch"
                class="h-[20px]"
                color="orange"
                size="small"
                label
                variant="outlined"
              >
                {{ item.arch }}
              </v-chip>
              <v-chip
                v-shared-tooltip="
                  () => t(item.isInternal ? 'java.internalJavaHint' : 'java.importedJavaHint')
                "
                class="installed-java-type h-[20px]"
                :color="item.isInternal ? 'green' : 'blue'"
                size="small"
                label
              >
                {{ t(item.isInternal ? 'java.internalJava' : 'java.importedJava') }}
              </v-chip>
            </v-list-item-title>
            <v-list-item-title v-else>
              {{ t('java.invalid') }}
            </v-list-item-title>
            <v-list-item-subtitle>{{ item.path }}</v-list-item-subtitle>

            <template #append>
              <v-btn
                v-if="item.valid"
                v-shared-tooltip="() => t('java.openFolder')"
                icon
                variant="text"
                size="small"
                @click.stop="showItemInDirectory(item.path)"
              >
                <v-icon>folder_open</v-icon>
              </v-btn>
              <v-btn
                v-shared-tooltip="() => t('shared.delete')"
                icon
                variant="text"
                size="small"
                color="red"
                @click.stop="onRemoveJava(item)"
              >
                <v-icon>delete</v-icon>
              </v-btn>
            </template>
          </v-list-item>

          <div class="grid grid-cols-1 lg:grid-cols-1 gap-4 pl-18 pr-4 pt-4">
            <div>
              <div class="font-weight-medium mb-2">
                <v-icon start size="small">settings_applications</v-icon>
                {{ t('instance.vmOptions') }}
              </div>
              <v-text-field
                :model-value="item.vmOptions?.join(' ') ?? ''"
                variant="outlined"
                density="compact"
                hide-details
                :placeholder="t('instance.vmOptionsHint')"
                @update:model-value="(value) => onVmOptionsChange(item, value)"
              />
            </div>
            <div>
              <div class="font-weight-medium mb-2">
                <v-icon start size="small">terminal</v-icon>
                {{ t('instance.prependCommand') }}
              </div>
              <v-text-field
                :model-value="item.prependCommand ?? ''"
                variant="outlined"
                density="compact"
                hide-details
                :placeholder="t('instance.prependCommandHint')"
                @update:model-value="(value) => onPrependCommandChange(item, value)"
              />
            </div>
          </div>
        </div>
      </v-list>
    </SettingCard>
  </div>
</template>

<script setup lang="ts">
import { BaseServiceKey, JavaRecord } from '@xmcl/runtime-api'
import { useService } from '@/composables'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { javaVendors, kJavaContext } from '@/composables/java'
import { shouldClearPinOnRemove } from '@/util/javaPin'
import SettingCard from '@/components/SettingCard.vue'
import { useGlobalSettings } from '@/composables/setting'
import { useEventListener } from '@vueuse/core'
import SettingJavaMemory from './SettingJavaMemory.vue'
import SettingJavaMemoryAssign from './SettingJavaMemoryAssign.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import JavaList from './BaseSettingJavaList.vue'
import JavaActions from '@/components/JavaActions.vue'
import { useDialog } from '@/composables/dialog.js'

const { t } = useI18n()
const { showItemInDirectory } = useService(BaseServiceKey)
const {
  globalAssignMemory,
  globalMaxMemory,
  globalMinMemory,
  globalJava,
  globalPreferredJavaVendor,
  defaultPreferredJavaVendor,
  setGlobalJavaSettings,
} = useGlobalSettings()
const { show: showInstaller } = useDialog('java-installer')
const { all: javas, update: updateJava, remove: removeJava } = injection(kJavaContext)

const javaPickerOpen = ref(false)
const emptyJava: JavaRecord = {
  path: '',
  version: '',
  majorVersion: 0,
  valid: false,
}
const preferredJavaPath = ref(globalJava.value)
const preferredJava = computed(() => javas.value.find((j) => j.path === preferredJavaPath.value))
const assignMemory = ref(globalAssignMemory.value)
const minMem = ref(globalMinMemory.value)
const maxMem = ref(globalMaxMemory.value)
const preferredVendor = ref(globalPreferredJavaVendor.value)
const vendors = computed(() =>
  javaVendors.map((vendor) => ({
    text: vendor.title,
    value: vendor.uid,
    icon: vendor.icon,
  })),
)

function onPickJava(value: JavaRecord) {
  preferredJavaPath.value = value.path
  javaPickerOpen.value = false
  saveOnLeave()
}

function onPrependCommandChange(item: JavaRecord, value: string) {
  updateJava(item, value.trim(), item.vmOptions)
}

function onVmOptionsChange(item: JavaRecord, value: string) {
  const vmOptions = value.trim() ? value.trim().split(/\s+/) : []

  updateJava(item, item.prependCommand, vmOptions)
}

async function onRemoveJava(value: JavaRecord) {
  if (shouldClearPinOnRemove(value.path, preferredJavaPath.value)) {
    preferredJavaPath.value = ''
    await save()
  }

  await removeJava(value, true)
}

onMounted(() => {
  assignMemory.value = globalAssignMemory.value
  minMem.value = globalMinMemory.value
  maxMem.value = globalMaxMemory.value
  preferredJavaPath.value = globalJava.value
  preferredVendor.value = globalPreferredJavaVendor.value
})

function save() {
  return setGlobalJavaSettings({
    globalAssignMemory: assignMemory.value,
    globalMaxMemory: maxMem.value,
    globalMinMemory: minMem.value,
    globalJava: preferredJavaPath.value,
    globalPreferredJavaVendor: preferredVendor.value,
  })
}

// Save settings when the component is unmounted or the user leaves the page
function saveOnLeave() {
  save().catch((error) => console.error('Failed to save Java settings', error))
}

onUnmounted(saveOnLeave)
useEventListener('beforeunload', saveOnLeave)
</script>

<style scoped>
:deep(.transparent-list) {
  background: transparent !important;
}

.java-profile-item.has-divider {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-bottom: 16px;
  margin-bottom: 16px;
}

.v-card {
  transition: all 0.2s ease;
}

.v-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.installed-java-type {
  border-radius: 8px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
