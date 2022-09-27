<template>
  <div class="flex gap-4">
    <div class="w-60">
      <page-skin-view
        class="flex overflow-auto relative justify-center items-center z-5"
        :user="user"
        :profile="gameProfile"
      />
    </div>
    <v-card class="p-4 overflow-x-hidden flex flex-col flex-grow">
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
        <v-list-item-action class="flex flex-row flex-grow-0">
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
          <v-list-item-subtitle class="overflow-auto">
            {{ t('userCape.description') }}
          </v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>

      <v-slide-group
        v-model="capeModel"
        mandatory
        show-arrows
      >
        <v-slide-item
          v-slot="{ active, toggle }"
        >
          <v-card
            :color="active ? 'primary' : 'grey lighten-1'"
            class="ma-4"
            height="200"
            width="100"
            @click="toggle"
          >
            <v-row
              class="fill-height"
              align="center"
              justify="center"
            >
              <div class="min-h-[120px] min-w-[80px] border-dashed border-2 mt-4" />
              <div class="text-sm font-bold text-white">
                {{ t('userCape.noCape') }}
              </div>
            </v-row>
          </v-card>
        </v-slide-item>
        <v-slide-item
          v-for="cape of capes"
          :key="cape.id"
          v-slot="{ active, toggle }"
        >
          <v-card
            :color="active ? 'primary' : 'grey lighten-1'"
            class="ma-4"
            height="200"
            width="100"
            @click="toggle"
          >
            <v-row
              class="fill-height"
              align="center"
              justify="center"
            >
              <player-cape
                class=" mt-4"
                :src="cape.url"
              />
              <div class="text-sm font-bold text-white">
                {{ cape.alias }}
              </div>
            </v-row>
          </v-card>
        </v-slide-item>
      </v-slide-group>
      <v-card-actions>
        <v-spacer />
        <v-btn
          text
          @click="save"
        >
          Save
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
import PageSkinView from './UserSkinView.vue'
import { useI18n, useRefreshable, useService } from '/@/composables'
import PlayerCape from '../components/PlayerCape.vue'
import { PlayerCapeModel, PlayerNameModel, usePlayerCape, usePlayerName, UserSkinModel, useUserSkin } from '../composables/userSkin'

const props = defineProps<{
  user: UserProfile
}>()

const { t } = useI18n()

const gameProfile = computed(() => props.user.profiles[props.user.selectedProfile])

const name = usePlayerName(gameProfile)
provide(PlayerNameModel, name)

const userSkinModel = useUserSkin(computed(() => props.user.id), gameProfile)
provide(UserSkinModel, userSkinModel)

const { slim } = userSkinModel

const currentCape = usePlayerCape(gameProfile)
provide(PlayerCapeModel, currentCape)

const capes = computed(() => gameProfile.value.capes ?? [])
const capeModel = computed({
  get() {
    if (currentCape.value) {
      const index = capes.value.findIndex(v => v.url === currentCape.value)
      if (index === -1) return 1
      return index + 1
    } else {
      return 0
    }
  },
  set(v) {
    currentCape.value = capes.value[v - 1]?.url
  },
})

const selectedCape = computed(() => capes.value[capeModel.value])
const { showCape, hideCape, checkNameAvailability, setName } = useService(OfficialUserServiceKey)
const nameError = ref('')

const changed = computed(() => {
  if (currentCape.value !== selectedCape.value.url) {
    return true
  }
  if (name.value !== gameProfile.value.name) {
    return true
  }
  return false
})

const { refresh: save, refreshing: saving } = useRefreshable(
  async function save() {
    if (name.value !== gameProfile.value.name) {
      const result = await checkNameAvailability(name.value)
      if (result === NameAvailability.AVAILABLE) {
        await setName(name.value)
      } else if (result === NameAvailability.DUPLICATE) {
        nameError.value = t('nameError.duplicate')
      } else if (result === NameAvailability.NOT_ALLOWED) {
        nameError.value = t('nameError.notAllowed')
      }
    }

    if (currentCape.value !== selectedCape.value.url) {
      if (selectedCape.value) {
        await showCape(selectedCape.value.id)
      } else {
        await hideCape()
      }
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
