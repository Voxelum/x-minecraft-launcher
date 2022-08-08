<template>
  <div class="flex gap-4">
    <div class="w-60">
      <page-skin-view
        class="flex overflow-auto relative justify-center items-center z-5"
        :user-id="user.id"
        :slim="slim"
        :profile-id="profileId"
        :name="gameProfile.name"
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
        v-model="model"
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
        <v-btn text>
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
import { UserProfile } from '@xmcl/runtime-api'
import PageSkinView from './UserSkinView.vue'
import { useI18n } from '/@/composables'
import PlayerCape from '../components/PlayerCape.vue'

const props = defineProps<{
  user: UserProfile
  profileId: string
}>()

const gameProfile = computed(() => props.user.profiles[props.profileId])
const slim = ref(gameProfile.value.textures.SKIN.metadata ? gameProfile.value.textures.SKIN.metadata.model === 'slim' : false)
const name = ref(gameProfile.value.name)
const capes = computed(() => gameProfile.value.capes ?? [])
const currentCape = computed(() => capes.value.every(c => c.state === 'INACTIVE') ? 0 : capes.value.findIndex(c => c.state === 'ACTIVE'))
const model = ref(currentCape)
const { t } = useI18n()
const changed = computed(() => {
  if (currentCape.value !== model.value) {
    return true
  }
  if (name.value !== gameProfile.value.name) {
    return true
  }
  if (slim.value !== gameProfile.value.textures.SKIN.metadata ? gameProfile.value.textures.SKIN.metadata.model === 'slim' : false) {
    return true
  }
  return false
})

watch(gameProfile, (p) => {
  name.value = p.name
})
</script>
<style scoped>
.cape {
  @apply hover:shadow-lg transition-shadow text-center;
}
</style>
