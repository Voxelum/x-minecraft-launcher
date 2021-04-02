<template>
  <v-list
    two-line
    class="user-list"
    style="overflow-y: auto; background: transparent"
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
        <v-list-tile
          v-data-transfer:id="user.id"
          draggable
          avatar
          @dragstart="$emit('dragstart', $event)"
          @dragend="$emit('dragend', $event)"
        >
          <v-list-tile-content>
            <v-list-tile-title>{{ user.username }}</v-list-tile-title>
            <v-list-tile-sub-title>
              <v-chip
                small
                outline
                label
                style="margin: 0; margin-top: 4px"
              >
                {{ $t("user.authMode") }}:
                {{ user.authService }}
              </v-chip>
              <v-chip
                small
                outline
                label
                style="margin: 0; margin-top: 4px"
              >
                {{ $t("user.profileMode") }}:
                {{ user.profileService }}
              </v-chip>
            </v-list-tile-sub-title>
          </v-list-tile-content>
          <v-list-tile-avatar
            v-if="user.avatar"
            :size="48"
          >
            <v-img :src="user.avatar" />
          </v-list-tile-avatar>
        </v-list-tile>
      </template>

      <template
        v-if="
          Object.keys(user.profiles).length === 0 &&
            user.authService === 'microsoft'
        "
      >
        <v-card color="orange">
          <v-list-tile
            v-ripple
            @click="gotoPurchesPage"
          >
            <v-list-tile-content>
              <v-list-tile-sub-title class="no-ownership">
                要使用此账户访问完整的《Minecraft:
                Java版》，请到我们的网站购买，然后继续您在 Minecraft
                中的冒险之旅吧。
              </v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>
        </v-card>
        <v-card color="orange">
          <v-list-tile
            v-ripple
            @click="gotoFAQPage"
          >
            <v-list-tile-content>
              <v-list-tile-sub-title class="no-ownership">
                或者您可以参照 Mojang 官方账户迁移 FAQ 来迁移账户
              </v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>
        </v-card>
      </template>
      <template
        v-for="p in user.profiles"
        v-else
      >
        <v-card
          :key="p.id + user.id"
          :class="{ green: p.id === profileId && user.id === userId }"
        >
          <v-list-tile
            avatar
            :disabled="user.selectedProfile !== p.id"
            @click="select(p.id, user.id)"
          >
            <v-list-tile-avatar>
              <image-show-texture-head
                :src="p.textures.SKIN.url"
                :dimension="50"
              />
            </v-list-tile-avatar>
            <v-list-tile-content>
              <v-list-tile-title>{{ p.name }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ p.id }}</v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>
        </v-card>
      </template>
    </v-list-group>
  </v-list>
</template>

<script lang="ts">
import { defineComponent } from '@vue/composition-api'
import { UserProfile } from '/@shared/entities/user.schema'
import { required } from '/@/util/props'
import { useService } from '/@/hooks'
import { BaseServiceKey } from '/@shared/services/BaseService'

export default defineComponent({
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
  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.2),
    0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12);
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
