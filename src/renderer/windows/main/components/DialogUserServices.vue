<template>
  <v-dialog :value="value" width="550" @input="$emit('input', $event)">
    <v-toolbar color="primary">
      <h2>
        {{ $t('user.service.title') }}
      </h2>
      <v-spacer />
      <v-toolbar-items>
        <v-btn icon flat @click="$emit('input', false)">
          <v-icon>close</v-icon>
        </v-btn>
      </v-toolbar-items>
    </v-toolbar>
    <v-card>
      <transition name="fade-transition" mode="out-in">
        <stepper-user-service-creation v-if="addingService" :modify="initing" @cancel="addingService=false" />
        <v-card-text v-else style="padding-left: 50px; padding-right: 50px; padding-bottom: 25px;">
          <v-list two-line>
            <template v-for="(s) in services">
              <v-list-tile :key="s.value">
                <v-list-tile-action>
                  <v-btn :disabled="s.value === 'mojang'" flat icon @click="newOrEdit(s)">
                    <v-icon> edit </v-icon>
                  </v-btn>
                </v-list-tile-action>
                <v-list-tile-content>
                  <v-list-tile-title>
                    {{ s.text }}
                  </v-list-tile-title>
                  <v-list-tile-sub-title>
                    {{ $t('user.authMode') }}: {{ s.body.hostName }}
                  </v-list-tile-sub-title>
                  <v-list-tile-sub-title>
                    {{ $t('user.profileMode') }}: {{ s.body.profile }}
                  </v-list-tile-sub-title>
                </v-list-tile-content>
                <v-list-tile-action>
                  <v-btn :disabled="s.value === 'mojang'" flat icon color="red"
                         @click="remove(s)">
                    <v-icon> delete </v-icon>
                  </v-btn>
                </v-list-tile-action>
              </v-list-tile>
            </template>
            <v-list-tile key="0" ripple @click="newOrEdit()">
              <v-list-tile-action>
                <v-icon>add</v-icon>
              </v-list-tile-action>
              <v-list-tile-content>
                <v-list-tile-title>{{ $t('user.service.add') }}</v-list-tile-title>
              </v-list-tile-content>
            </v-list-tile>
          </v-list>
        </v-card-text>
      </transition>
    </v-card>
  </v-dialog>
</template>

<script>

export default {
  props: {
    value: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      editingService: -1,
      addingService: false,
      authOrProfile: 0,

      initing: '',

      newAuthServiceName: '',
      newAuthServiceHost: '',
    };
  },
  computed: {
    services() {
      const keys = [];
      for (const k of Object.keys(this.$repo.state.user.authServices)) {
        if (keys.indexOf(k) === -1) {
          keys.push(k);
        }
      }
      for (const k of Object.keys(this.$repo.state.user.profileServices)) {
        if (keys.indexOf(k) === -1) {
          keys.push(k);
        }
      }
      return keys.map(name => ({
        text: name,
        value: name,
        body: { 
          ...(this.$repo.state.user.authServices[name] || {}),
          ...(this.$repo.state.user.profileServices[name] || {}),
        },
      }));
    },
    authServices() {
      return Object.entries(this.$repo.state.user.authServices)
        .map(([name, value]) => ({
          text: this.$t(`user.${name}.name`),
          value: name,
          body: value,
        }));
    },
    profileServices() {
      return this.$repo.getters.profileServices.map(m => ({
        text: this.$t(`user.${m}.name`),
        value: m,
      }));
    },
    gameProfiles() { return this.$repo.getters.avaiableGameProfiles; },
    logined() { return this.$repo.getters.logined; },
  },
  watch: {
    value() {
      if (this.value) {
        this.addingService = false;
      }
    },
  },
  mounted() {
  },
  methods: {
    remove(s) {
      this.$repo.commit('removeService', s.value);
    },
    newOrEdit(s) {
      if (s) {
        this.initing = s.value;
      } else {
        this.initing = '';
      }
      this.addingService = true;
    },
  },
};
</script>

<style>
.input-group {
  padding-top: 5px;
}
.password {
  padding-top: 5px;
}
.input-group--text-field label {
  top: 5px;
}
</style>
