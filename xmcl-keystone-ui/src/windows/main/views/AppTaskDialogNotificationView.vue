<template>
  <v-card
    flat
    style="min-height: 300px; max-height: 400px; max-width: 100%; overflow: auto;"

    color="grey en-4"
  >
    <v-card-text>
      {{ queue.length === 0 ? $t('notification.empty') : '' }}
      <v-list
        style="background: transparent"
      >
        <transition-group
          name="transition-list"
          tag="div"
        >
          <template v-for="(item, index) in queue">
            <v-list-item
              :key="item.title + index"
              @click="onClick(item)"
            >
              <v-list-item-avatar>
                <v-icon
                  :color="colors[item.level]"
                  left
                >
                  {{ icons[item.level] }}
                </v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title v-html="item.title" />
                <v-list-item-subtitle v-html="item.body" />
              </v-list-item-content>
            </v-list-item>
          </template>
        </transition-group>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'
import { LocalNotification, useNotificationQueue } from '../composables/notifier'

export default defineComponent({
  setup() {
    const queue = useNotificationQueue()
    function onClick(not: LocalNotification) {
      queue.value = queue.value.filter(q => q !== not)
    }
    return {
      queue,
      icons: {
        success: 'check_circle',
        info: 'info',
        warning: 'priority_high',
        error: 'warning',
      },
      colors: {
        success: 'green',
        error: 'red',
        info: 'white',
        warning: 'orange',
      },
      onClick,
    }
  },
})
</script>

<style scoped=true>
.v-treeview-node__label {
  font-size: 14px;
}
.v-treeview-node__label .material-icons-outlined {
  font-size: 20px;
}
.tree-minor-label {
  color: grey;
  font-size: 12px;
  font-style: italic;
}
</style>
