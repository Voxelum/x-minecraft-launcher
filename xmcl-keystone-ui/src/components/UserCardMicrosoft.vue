<template>
  <div class="flex max-w-full flex-row gap-4">
    <v-card
      class="flex grow flex-col overflow-x-hidden p-2 "
      flat
      color="transparent"
    >
      <div class="flex justify-center">
        <UserSkin
          class="z-5 min-w-50 relative flex items-center justify-center overflow-auto overflow-x-hidden"
          inspect
          :user="user"
          :profile="gameProfile"
        />
        <div>
          <v-list-item>
            <v-list-item-avatar class="md:hidden lg:block">
              <v-icon>
                badge
              </v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>
                {{ t('user.name') }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ t('user.nameHint') }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action class="flex grow-0 flex-row">
              <v-text-field
                v-model="name"
                dense
                outlined
                hide-details
              />
            </v-list-item-action>
          </v-list-item>
          <v-list-item>
            <v-list-item-avatar class="md:hidden lg:block">
              <v-icon>
                accessibility_new
              </v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>
                {{ t('userSkin.useSlim') }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ t('userSkin.skinType') }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-switch v-model="slim" />
            </v-list-item-action>
          </v-list-item>

          <v-list-item>
            <v-list-item-content>
              <v-list-item-title>
                {{ t('userCape.changeTitle') }}
              </v-list-item-title>
              <v-list-item-subtitle class="max-w-100 overflow-hidden whitespace-pre-wrap">
                {{ t('userCape.description') }}
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>

          <v-slide-group
            v-model="capeModel"
            mandatory
            show-arrows
            class="max-w-[400px] overflow-x-auto"
          >
            <v-slide-item
              v-slot="{ active, toggle }"
            >
              <v-card
                :color="active ? 'primary' : 'grey lighten-1'"
                class="ma-4 py-2"
                height="200"
                width="100"
                @click="toggle"
              >
                <div
                  class="flex flex-col justify-around items-center fill-height"
                >
                  <div class="mt-4 min-h-[120px] min-w-[80px] border-2 border-dashed" />
                  <div class="text-sm font-bold text-white">
                    {{ t('userCape.noCape') }}
                  </div>
                </div>
              </v-card>
            </v-slide-item>
            <v-slide-item
              v-for="c of capes"
              :key="c.id"
              v-slot="{ active, toggle }"
            >
              <v-card
                :color="active ? 'primary' : 'grey lighten-1'"
                class="ma-4 py-2"
                height="200"
                width="100"
                @click="toggle"
              >
                <div
                  class="flex flex-col justify-around items-center fill-height"
                >
                  <PlayerCape
                    class="mt-4"
                    :src="c.url"
                  />
                  <div class="text-sm font-bold text-white">
                    {{ c.alias }}
                  </div>
                </div>
              </v-card>
            </v-slide-item>
          </v-slide-group>
        </div>
      </div>

      <v-card-actions>
        <v-spacer />
        <v-btn
          :disabled="!changed"
          :loading="saving"
          text
          @click="save"
        >
          {{ t('userSkin.save') }}
          <v-icon right>
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
