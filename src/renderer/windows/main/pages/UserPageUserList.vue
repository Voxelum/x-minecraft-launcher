<template>
  <v-list
    two-line
    class="user-list"
    style="overflow-y: auto; background: transparent;"
  >
    <v-list-group
      v-for="user in users"
      :key="user.id"
      v-draggable-card
      sub-group
      class="draggable-card"
      @dragstart="$emit('dragstart', $event)"
      @dragend="$emit('dragend', $event)"
    >
      <template v-slot:activator>
        <v-list-tile
          v-data-transfer:id="user.id"
          draggable
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
                {{ $t('user.authMode') }}:
                {{ user.authService }}
              </v-chip>
              <v-chip
                small
                outline
                label
                style="margin: 0; margin-top: 4px"
              >
                {{ $t('user.profileMode') }}:
                {{ user.profileService }}
              </v-chip>
            </v-list-tile-sub-title>
          </v-list-tile-content>
        </v-list-tile>

        <!-- </v-card> -->
      </template>
      <template v-for="p in user.profiles">
        <v-card
          :key="p.id + user.id"
          :class="{ green: p.id === profileId && user.id === userId }"
          style="margin-bottom: 10px;"
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
import { defineComponent } from '@vue/composition-api';
import { UserProfile } from '@universal/store/modules/user.schema';

interface Props {
  select(profileId: string, userId: string): void;
  users: UserProfile[];
  userId: string;
  profileId: string;
}

export default defineComponent<Props>({
  props: { select: Function, userId: String, profileId: String, users: Array },
});
</script>

<style >
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
</style>
