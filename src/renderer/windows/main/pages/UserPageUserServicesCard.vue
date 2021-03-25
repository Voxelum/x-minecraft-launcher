<template>
  <v-card>
    <transition
      name="fade-transition"
      mode="out-in"
    >
      <stepper-user-service
        v-if="addingService"
        :modify="loading"
        @cancel="addingService=false"
      />
      <v-card-text
        v-else
        style="padding-left: 50px; padding-right: 50px; padding-bottom: 25px;"
      >
        <v-list two-line>
          <template v-for="(s) in services">
            <v-list-tile :key="s.value">
              <v-list-tile-action>
                <v-btn
                  :disabled="s.value === 'mojang'"
                  flat
                  icon
                  @click="newOrEdit(s)"
                >
                  <v-icon>edit</v-icon>
                </v-btn>
              </v-list-tile-action>
              <v-list-tile-content>
                <v-list-tile-title>{{ s.text }}</v-list-tile-title>
                <v-list-tile-sub-title>{{ $t('user.authMode') }}: {{ s.body.hostName }}</v-list-tile-sub-title>
                <v-list-tile-sub-title>{{ $t('user.profileMode') }}: {{ s.body.profile }}</v-list-tile-sub-title>
              </v-list-tile-content>
              <v-list-tile-action>
                <v-btn
                  :disabled="s.value === 'mojang'"
                  flat
                  icon
                  color="red"
                  @click="remove(s)"
                >
                  <v-icon>delete</v-icon>
                </v-btn>
              </v-list-tile-action>
            </v-list-tile>
          </template>
          <v-list-tile
            key="0"
            ripple
            @click="newOrEdit(undefined)"
          >
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
</template>

<script lang=ts>
import { reactive, toRefs, computed, defineComponent } from '@vue/composition-api'
import { useStore } from '/@/hooks'
import StepperUserService from './UserPageUserServiceStepper.vue'

interface Service {
  text: string
  value: string
  body: any
}

export default defineComponent({
  components: {
    StepperUserService,
  },
  setup() {
    const { state, commit } = useStore()
    const data = reactive({
      editingService: -1,
      addingService: false,
      authOrProfile: 0,

      loading: '',

      newAuthServiceName: '',
      newAuthServiceHost: '',
    })

    const services = computed(() => {
      const keys = []
      for (const k of Object.keys(state.user.authServices)) {
        if (keys.indexOf(k) === -1) {
          keys.push(k)
        }
      }
      for (const k of Object.keys(state.user.profileServices)) {
        if (keys.indexOf(k) === -1) {
          keys.push(k)
        }
      }
      return keys.map(name => ({
        text: name,
        value: name,
        body: {
          ...(state.user.authServices[name] || {}),
          ...(state.user.profileServices[name] || {}),
        },
      }))
    })

    return {
      ...toRefs(data),
      services,
      remove(s: Service) {
        commit('authServiceRemove', s.value)
        commit('profileServiceRemove', s.value)
      },
      newOrEdit(s?: Service) {
        if (s) {
          data.loading = s.value
        } else {
          data.loading = ''
        }
        data.addingService = true
      },
    }
  },
})
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
