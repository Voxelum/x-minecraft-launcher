<template>
  <v-list
    class="base-settings"
    two-line
    subheader
  >
    <v-subheader
      style="padding-right: 2px"
    >
      {{ t("server.name", 1) }}
    </v-subheader>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("server.host") }}
        </v-list-item-title>
      </v-list-item-content>
      <v-list-item-action>
        <v-text-field
          v-model="data.host"
          hide-details
          solo

          placeholder="www.whatever.com"
          required
        />
      </v-list-item-action>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("server.port") }}
        </v-list-item-title>
      </v-list-item-content>
      <v-list-item-action>
        <v-text-field
          v-model="data.port"
          solo
          hide-details
          placeholder="25565"
          required
        />
      </v-list-item-action>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("server.quickPlayMultiplayer") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("server.quickPlayMultiplayerHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-text-field
          v-model="data.quickPlayMultiplayer"
          solo
          hide-details
          placeholder="play.hypixel.net:25565"
        />
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>

<script lang=ts setup>
import { injection } from '@/util/inject'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'

const { data } = injection(InstanceEditInjectionKey)
const { t } = useI18n()

</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important
}
.v-btn {
  margin: 0
}
</style>
<style>
.local-version .v-select__selection--comma {
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.base-settings {
  background: transparent !important;
  width: 100%;
}
.base-settings .v-text-field--box input,
.v-text-field--full-width input,
.v-text-field--outlined input {
  margin-top: 0
}

/* .base-settings .v-list__tile__content {
  flex-grow: 1
  max-width: 40%
} */
</style>
