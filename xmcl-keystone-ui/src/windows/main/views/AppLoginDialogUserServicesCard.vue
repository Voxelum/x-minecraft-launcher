<template>
  <div>
    <v-card-text
      style="padding-left: 50px; padding-right: 50px; padding-bottom: 25px;"
    >
      <v-list two-line>
        <template v-for="(s) in services">
          <v-list-item :key="s.value">
            <v-list-item-action>
              <v-btn
                :disabled="s.value === 'mojang'"
                text
                icon
                @click="newOrEdit(s)"
              >
                <v-icon>edit</v-icon>
              </v-btn>
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{ s.text }}</v-list-item-title>
              <v-list-item-subtitle>{{ $t('user.authMode') }}: {{ s.body.hostName }}</v-list-item-subtitle>
              <v-list-item-subtitle>{{ $t('user.profileMode') }}: {{ s.body.profile }}</v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                :disabled="s.value === 'mojang'"
                text
                icon
                color="red"
                @click="remove(s)"
              >
                <v-icon>delete</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </template>
        <v-list-item
          key="0"
          ripple
          @click="newOrEdit(undefined)"
        >
          <v-list-item-action>
            <v-icon>add</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>{{ $t('user.service.add') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-card-text>
  </div>
</template>

<script lang=ts>
import { UserServiceKey } from '@xmcl/runtime-api'
import { useService } from '/@/composables'

interface Service {
  text: string
  value: string
  body: any
}

export default defineComponent({
  components: {
  },
  setup(props, context) {
    const { state } = useService(UserServiceKey)
    const data = reactive({
      editingService: -1,
      authOrProfile: 0,

      loading: '',

      newAuthServiceName: '',
      newAuthServiceHost: '',
    })

    const services = computed(() => {
      const keys = []
      for (const k of Object.keys(state.authServices)) {
        if (keys.indexOf(k) === -1) {
          keys.push(k)
        }
      }
      for (const k of Object.keys(state.profileServices)) {
        if (keys.indexOf(k) === -1) {
          keys.push(k)
        }
      }
      return keys.map(name => ({
        text: name,
        value: name,
        body: {
          ...(state.authServices[name] || {}),
          ...(state.profileServices[name] || {}),
        },
      }))
    })

    return {
      ...toRefs(data),
      services,
      remove(s: Service) {
        state.authServiceRemove(s.value)
        state.profileServiceRemove(s.value)
      },
      newOrEdit(s?: Service) {
        if (s) {
          data.loading = s.value
        } else {
          data.loading = ''
        }
        context.emit('route', 'edit-service')
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
