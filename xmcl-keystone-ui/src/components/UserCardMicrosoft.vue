<template>
  <div class="flex max-w-full flex-col h-full overflow-hidden w-full">
    <div class="flex-grow flex flex-row gap-12 justify-center overflow-y-auto invisible-scroll">
      <!-- 3D Skin Renderer -->
      <div class="flex-shrink-0 flex items-center justify-center p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 w-80">
        <UserSkin
          class="relative flex items-center justify-center w-full h-full min-h-[420px]"
          inspect
          :user="user"
          :profile="gameProfile"
        />
      </div>

      <!-- Settings Panel -->
      <div class="flex-grow flex flex-col gap-6 py-2 min-w-0 pr-2 max-w-[300px]">
        <!-- Nickname Setting -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <v-icon size="18">badge</v-icon>
            {{ t('user.name') }}
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 m-0">{{ t('user.nameHint') }}</p>
          <input
            v-model="name"
            type="text"
            class="mt-2 w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm dark:text-gray-200"
            :placeholder="t('user.name')"
          />
          <p v-if="nameError" class="text-error text-xs mt-1">{{ nameError }}</p>
        </div>

        <div class="h-px bg-black/10 dark:bg-white/10 w-full"></div>

        <!-- Skin Type Setting (Slim/Classic) -->
        <div 
          class="flex items-center justify-between cursor-pointer py-3 px-4 rounded-xl border transition-colors duration-200 select-none"
          :class="slim ? 'border-primary bg-primary/10' : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'"
          @click="slim = !slim"
        >
          <div class="flex flex-col">
            <div class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors" :class="slim ? 'text-primary' : ''">
              <v-icon size="18" :color="slim ? 'primary' : ''">accessibility_new</v-icon>
              {{ t('userSkin.useSlim') }}
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 m-0 mt-1">{{ t('userSkin.skinType') }}</p>
          </div>
          <div class="w-11 h-6 shrink-0 rounded-full relative transition-colors duration-300" :class="slim ? 'bg-primary' : 'bg-black/20 dark:bg-white/20'">
            <div class="w-5 h-5 bg-white rounded-full absolute top-[2px] transition-all duration-300 shadow-sm" :class="slim ? 'left-[22px]' : 'left-[2px]'"></div>
          </div>
        </div>

        <div class="h-px bg-black/10 dark:bg-white/10 w-full"></div>

        <!-- Cape Selection -->
        <div class="flex flex-col gap-3">
          <div class="flex flex-col">
            <div class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <v-icon size="18">dry_cleaning</v-icon>
              {{ t('userCape.changeTitle') }}
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 m-0 mt-1">{{ t('userCape.description') }}</p>
          </div>

          <v-slide-group
            v-model="capeModel"
            mandatory
            show-arrows
            class="max-w-full overflow-x-auto mt-2"
          >
            <!-- No Cape Option -->
            <v-slide-item v-slot="{ active, toggle }">
              <div
                class="mx-2 my-1 cursor-pointer transition-all duration-200 w-[90px] h-[160px] rounded-2xl flex flex-col items-center justify-center gap-3 border-2"
                :class="active ? 'border-primary bg-primary/10 shadow-md shadow-primary/20' : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'"
                @click="toggle"
              >
                <div class="w-16 h-[90px] border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-lg flex items-center justify-center">
                  <v-icon color="grey">close</v-icon>
                </div>
                <div class="text-xs font-semibold text-center w-full px-1 truncate" :class="active ? 'text-primary' : 'text-gray-600 dark:text-gray-400'">
                  {{ t('userCape.noCape') }}
                </div>
              </div>
            </v-slide-item>

            <!-- Cape Options -->
            <v-slide-item
              v-for="c of capes"
              :key="c.id"
              v-slot="{ active, toggle }"
            >
              <div
                class="mx-2 my-1 cursor-pointer transition-all duration-200 w-[90px] h-[160px] rounded-2xl flex flex-col items-center justify-center gap-3 border-2 p-2"
                :class="active ? 'border-primary bg-primary/10 shadow-md shadow-primary/20' : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'"
                @click="toggle"
              >
                <PlayerCape
                  class="h-[90px] w-auto drop-shadow-md rounded-lg overflow-hidden flex-shrink-0"
                  :src="c.url"
                />
                <div class="text-xs font-semibold text-center w-full truncate" :class="active ? 'text-primary' : 'text-gray-600 dark:text-gray-400'">
                  {{ c.alias }}
                </div>
              </div>
            </v-slide-item>
          </v-slide-group>
        </div>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="flex-shrink-0 flex justify-end pt-4 mt-2 border-t border-black/10 dark:border-white/10">
      <v-btn
        color="primary"
        class="rounded-xl font-medium px-6 text-sm flex items-center gap-2"
        :disabled="!changed"
        :loading="saving"
        depressed
        @click="save"
      >
        <v-icon size="18" left>save</v-icon>
        {{ t('userSkin.save') }}
      </v-btn>
    </div>
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
