<template>
  <v-list
    class="base-settings"
    two-line
    subheader
  >
    <v-subheader style="padding-right: 2px">
      {{ $tc("modpack.name", 1) }}
    </v-subheader>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{ $t("modpack.author") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ $t("modpack.authorHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action style="flex-grow: 0">
        <v-text-field
          v-model="data.author"
          hide-details
          :placeholder="username"
          solo
          required
        />
      </v-list-item-action>
    </v-list-item>
    <v-list-item style="margin-top: 5px">
      <v-list-item-content>
        <v-list-item-title>
          {{ $t("modpack.description") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-text-field
            v-model="data.description"
            class="m-1 mt-2"
            solo
            hide-details
            :placeholder="$t('modpack.descriptionHint')"
          />
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>

    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{ $t("modpack.url") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ $t("modpack.urlHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action style="width: 50%">
        <v-text-field
          v-model="data.url"
          class="m-1 mt-2"
          solo
          hide-details
          :placeholder="$t('modpack.urlHint')"
        />
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>

<script lang="ts" setup>
import { useGameProfile, useProfileId, useSelectedUser } from '../composables/user'
import { injection } from '/@/util/inject'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'

const { data } = injection(InstanceEditInjectionKey)
const { userId, profileId } = useSelectedUser()
const { gameProfile } = useProfileId(userId, profileId)
const { name: username } = useGameProfile(gameProfile)

</script>

<style scoped="true">
.flex {
  padding: 6px 8px !important
}

.v-btn {
  margin: 0
}
</style>
