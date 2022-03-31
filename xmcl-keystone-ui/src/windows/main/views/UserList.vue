<template>
  <v-list
    two-line
    color="transparent"
    class="user-list"
  >
    <v-list-group
      v-for="user in users"
      :key="user.id"
      v-draggable-card
      :value="user.id === userId"
      sub-group
      class="draggable-card"
      @dragstart="$emit('dragstart', $event)"
      @dragend="$emit('dragend', $event)"
    >
      <template #activator>
        <v-list-item
          v-data-transfer:id="user.id"
          draggable
          @dragstart="$emit('dragstart', $event)"
          @dragend="$emit('dragend', $event)"
        >
          <v-list-item-content>
            <v-list-item-title>{{ user.username }}</v-list-item-title>
            <v-list-item-subtitle>
              <v-chip
                small
                outlined
                label
                style="margin: 0; margin-top: 4px"
              >
                {{ $t("user.authMode") }}:
                {{ user.authService }}
              </v-chip>
              <v-chip
                small
                outlined
                label
                style="margin: 0; margin-top: 4px; margin-left: 5px;"
              >
                {{ $t("user.profileMode") }}:
                {{ user.profileService }}
              </v-chip>
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-avatar
            v-if="user.avatar"
            :size="48"
          >
            <v-img :src="user.avatar" />
          </v-list-item-avatar>
        </v-list-item>
      </template>

      <template
        v-if="
          Object.keys(user.profiles).length === 0 &&
            user.authService === 'microsoft'
        "
      >
        <v-card color="orange">
          <v-list-item
            v-ripple
            @click="gotoPurchesPage"
          >
            <v-list-item-content>
              <v-list-item-subtitle class="no-ownership">
                要使用此账户访问完整的《Minecraft:
                Java版》，请到我们的网站购买，然后继续您在 Minecraft
                中的冒险之旅吧。
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </v-card>
        <v-card color="orange">
          <v-list-item
            v-ripple
            @click="gotoFAQPage"
          >
            <v-list-item-content>
              <v-list-item-subtitle class="no-ownership">
                或者您可以参照 Mojang 官方账户迁移 FAQ 来迁移账户
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </v-card>
      </template>
      <template
        v-for="p in user.profiles"
        v-else
      >
        <v-card
          :key="p.id + user.id"
          outlined
          flat
          :class="{ green: p.id === profileId && user.id === userId }"
        >
          <v-list-item
            :disabled="user.selectedProfile !== p.id"
            @click="select(p.id, user.id)"
          >
            <v-list-item-avatar>
              <image-show-texture-head
                :src="p.textures.SKIN.url"
                :dimension="50"
              />
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>{{ p.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ p.id }}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </v-card>
      </template>
    </v-list-group>
  </v-list>
</template>

<script lang="ts">
import { UserProfile, BaseServiceKey } from '@xmcl/runtime-api'
import { required } from '/@/util/props'
import { useService } from '/@/composables'
import ImageShowTextureHead from '../components/PlayerAvatar.vue'

export default defineComponent({
  components: { ImageShowTextureHead },
  props: {
    select: required<(profileId: string, userId: string) => void>(Function),
    users: required<UserProfile[]>(Array),
    userId: required<string>(String),
    profileId: required<string>(String),
  },
  setup() {
    const { openInBrowser } = useService(BaseServiceKey)
    function gotoPurchesPage() {
      openInBrowser('https://www.minecraft.net/store/minecraft-java-edition?ref=launcher')
    }
    function gotoFAQPage() {
      openInBrowser('https://help.minecraft.net/hc/en-us/articles/360050865492-Minecraft-Java-Edition-Account-Migration-FAQ')
    }
    return { gotoPurchesPage, gotoFAQPage }
  },
})
</script>

<style>
.user-list
  .v-list__group__header--sub-group
  .v-list__group__header__prepend-icon {
  padding: 0 16px;
}
.user-list .v-list__group__header.v-list__group__header--sub-group {
  margin-bottom: 10px;
  background: #424242;
  border-radius: 2px;
  /* box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.2),
    0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12); */
  transition: all 0.3s;
}
.user-list .v-list__group__header.v-list__group__header--sub-group:hover {
  background: #4caf50;
}
.user-list .v-card {
  margin-bottom: 10px;
}

.no-ownership {
  white-space: unset;
  overflow: unset;
  text-overflow: unset;
  color: white !important;
}
</style>
