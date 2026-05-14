<template>
  <div class="flex max-w-full flex-row gap-6">
    <v-card
      class="flex grow flex-col overflow-x-hidden p-4 rounded-3xl backdrop-blur-md shadow-xl border"
      style="background: rgba(var(--v-theme-on-surface), 0.05); border-color: rgba(var(--v-theme-on-surface), 0.1);"
      flat
      color="transparent"
    >
      <div class="flex flex-col md:flex-row gap-8 justify-center items-start">
        <div class="relative group">
          <div class="absolute inset-0 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-colors duration-500"></div>
          <UserSkin
            class="z-10 min-w-50 relative flex items-center justify-center overflow-visible drop-shadow-2xl transition-transform duration-500 hover:scale-105"
            inspect
            :user="user"
            :profile="gameProfile"
          />
        </div>
        
        <div class="flex flex-col gap-4 w-full max-w-[450px]">
          <!-- Profile Settings List -->
          <div class="backdrop-blur-lg rounded-2xl p-2 border shadow-inner" style="background: rgba(var(--v-theme-surface), 0.6); border-color: rgba(var(--v-theme-on-surface), 0.05);">
            <v-list-item class="rounded-xl transition-colors" style="--v-hover-opacity: 0.08;" rounded>
              <template #prepend>
                <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mr-4 hidden lg:flex">
                  <v-icon color="blue">badge</v-icon>
                </div>
              </template>
              <template #title>
                <span class="font-semibold" style="color: rgba(var(--v-theme-on-surface), 0.9);">{{ t('user.name') }}</span>
              </template>
              <template #subtitle>
                <span class="text-xs opacity-70" style="color: rgba(var(--v-theme-on-surface), 0.6);">{{ t('user.nameHint') }}</span>
              </template>
              <template #append>
                <v-text-field
                  v-model="name"
                  density="compact"
                  variant="outlined"
                  rounded="lg"
                  hide-details
                  style="min-width: 180px;"
                />
              </template>
            </v-list-item>

            <v-divider class="my-1 mx-4 opacity-50" style="border-color: rgba(var(--v-theme-on-surface), 0.2);"></v-divider>

            <v-list-item class="rounded-xl transition-colors" style="--v-hover-opacity: 0.08;" rounded>
              <template #prepend>
                <div class="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mr-4 hidden lg:flex">
                  <v-icon color="green">accessibility_new</v-icon>
                </div>
              </template>
              <template #title>
                <span class="font-semibold" style="color: rgba(var(--v-theme-on-surface), 0.9);">{{ t('userSkin.useSlim') }}</span>
              </template>
              <template #subtitle>
                <span class="text-xs opacity-70" style="color: rgba(var(--v-theme-on-surface), 0.6);">{{ t('userSkin.skinType') }}</span>
              </template>
              <template #append>
                <v-switch v-model="slim" hide-details color="primary" inset />
              </template>
            </v-list-item>
          </div>

          <!-- Cape Selector -->
          <div class="mt-2">
            <v-list-item class="px-0">
              <template #title>
                <span class="font-bold text-lg" style="color: rgba(var(--v-theme-on-surface), 0.9);">{{ t('userCape.changeTitle') }}</span>
              </template>
              <template #subtitle>
                <span class="max-w-100 overflow-hidden whitespace-pre-wrap text-sm opacity-70" style="color: rgba(var(--v-theme-on-surface), 0.6);">
                  {{ t('userCape.description') }}
                </span>
              </template>
            </v-list-item>

            <v-slide-group
              v-model="capeModel"
              mandatory
              show-arrows
              class="max-w-[450px] overflow-x-auto py-4"
            >
              <v-slide-group-item
                v-slot="{ isSelected, toggle }"
              >
                <v-card
                  :color="isSelected ? 'primary' : 'transparent'"
                  class="ma-2 py-2 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl border-2"
                  :class="isSelected ? 'border-primary shadow-primary/30' : 'backdrop-blur-sm'"
                  :style="!isSelected ? 'border-color: rgba(var(--v-theme-on-surface), 0.2); background: rgba(var(--v-theme-surface), 0.5);' : ''"
                  height="200"
                  width="100"
                  @click="toggle"
                  elevation="0"
                >
                  <div
                    class="flex flex-col justify-around items-center fill-height"
                  >
                    <div class="mt-4 min-h-[120px] min-w-[80px] border-2 border-dashed border-current opacity-30 rounded-lg flex items-center justify-center">
                      <v-icon size="32" class="opacity-50">block</v-icon>
                    </div>
                    <div class="text-sm font-bold" :style="isSelected ? 'color: white;' : 'color: rgba(var(--v-theme-on-surface), 0.7);'">
                      {{ t('userCape.noCape') }}
                    </div>
                  </div>
                </v-card>
              </v-slide-group-item>
              
              <v-slide-group-item
                v-for="c of capes"
                :key="c.id"
                v-slot="{ isSelected, toggle }"
              >
                <v-card
                  :color="isSelected ? 'primary' : 'transparent'"
                  class="ma-2 py-2 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl border-2 overflow-hidden"
                  :class="isSelected ? 'border-primary shadow-primary/30' : 'backdrop-blur-sm'"
                  :style="!isSelected ? 'border-color: rgba(var(--v-theme-on-surface), 0.2); background: rgba(var(--v-theme-surface), 0.5);' : ''"
                  height="200"
                  width="100"
                  @click="toggle"
                  elevation="0"
                >
                  <div
                    class="flex flex-col justify-around items-center fill-height relative z-10"
                  >
                    <PlayerCape
                      class="mt-4 drop-shadow-lg"
                      :src="c.url"
                    />
                    <div class="text-sm font-bold px-2 text-center w-full truncate" :style="isSelected ? 'color: white;' : 'color: rgba(var(--v-theme-on-surface), 0.7);'">
                      {{ c.alias }}
                    </div>
                  </div>
                </v-card>
              </v-slide-group-item>
            </v-slide-group>
          </div>
        </div>
      </div>

      <v-card-actions class="mt-6 border-t pt-4" style="border-color: rgba(var(--v-theme-on-surface), 0.08);">
        <v-spacer />
        <v-btn
          :disabled="!changed"
          :loading="saving"
          @click="save"
          color="primary"
          rounded="xl"
          class="font-bold px-6 shadow-md transition-all"
          :class="changed ? 'hover:shadow-lg hover:shadow-primary/40 transform hover:-translate-y-0.5' : ''"
          variant="flat">
          {{ t('userSkin.save') }}
          <v-icon end>
            save
          </v-icon>
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>
<script lang="ts" setup>
import { NameAvailability, OfficialUserServiceKey, UserProfile } from '@xmcl/runtime-api'
import PlayerCape from '../components/PlayerCape.vue'
import { PlayerNameModel, usePlayerName, UserSkinModel, useUserSkin } from '../composables/userSkin'
import UserSkin from './UserSkin.vue'
import { useRefreshable, useService } from '@/composables'

const props = defineProps<{
  user: UserProfile
}>()

const { t } = useI18n()

const gameProfile = computed(() => props.user.profiles[props.user.selectedProfile])

const name = usePlayerName(gameProfile)
provide(PlayerNameModel, name)

const userSkinModel = useUserSkin(computed(() => props.user.id), gameProfile)
provide(UserSkinModel, userSkinModel)

const { slim, modified, save: saveSkin, cape } = userSkinModel

const capes = computed(() => gameProfile.value.capes ?? [])
const capeModel = computed({
  get() {
    if (cape.value) {
      const index = capes.value.findIndex(v => v.url === cape.value)
      if (index === -1) return 0
      return index + 1
    } else {
      return 0
    }
  },
  set(v) {
    if (v === 0) {
      cape.value = undefined
    } else {
      cape.value = capes.value[v - 1]?.url
    }
  },
})

const currentCape = computed(() => capes.value.find(v => v.state === 'ACTIVE'))
const { checkNameAvailability, setName } = useService(OfficialUserServiceKey)
const nameError = ref('')

const changed = computed(() => {
  if (cape.value !== currentCape.value?.url) {
    return true
  }
  if (name.value !== gameProfile.value.name) {
    return true
  }
  if (modified.value) {
    return true
  }
  return false
})

const { refresh: save, refreshing: saving } = useRefreshable(
  async function save() {
    if (name.value !== gameProfile.value.name) {
      const result = await checkNameAvailability(props.user, name.value)
      if (result === NameAvailability.AVAILABLE) {
        await setName(props.user, name.value)
      } else if (result === NameAvailability.DUPLICATE) {
        nameError.value = t('nameError.duplicate')
      } else if (result === NameAvailability.NOT_ALLOWED) {
        nameError.value = t('nameError.notAllowed')
      }
    }

    if (modified.value) {
      await saveSkin()
    }
  },
)

watch(gameProfile, (p) => {
  name.value = p.name
})
</script>
<style scoped>
.cape {
  @apply hover:shadow-lg transition-shadow text-center;
}
</style>
