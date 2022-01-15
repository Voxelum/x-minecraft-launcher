<template>
  <v-navigation-drawer
    :value="true"
    :mini-variant="true"
    stateless
    dark
    style="border-radius: 2px 0 0 2px; height: unset;"
    class="moveable sidebar"
  >
    <v-list class="non-moveable p-0">
      <!-- <v-divider
        dark
        style="display: block !important;"
      /> -->
      <v-list-tile
        push
        to="/"
      >
        <v-list-tile-action>
          <v-icon>home</v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <v-list-tile
        push
        to="/instances"
      >
        <v-list-tile-action>
          <v-icon>apps</v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <v-list-tile
        push
        to="/user"
      >
        <v-list-tile-action>
          <v-icon>person</v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <v-list-tile
        push
        to="/curseforge"
      >
        <v-list-tile-action style="padding-right: 2px;">
          <v-icon :size="14">
            $vuetify.icons.curseforge
          </v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <v-list-tile
        push
        to="/modrinth"
      >
        <v-list-tile-action>
          <v-icon>
            $vuetify.icons.modrinth
          </v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <!-- <v-list-tile
        push
        to="/mcwiki"
      >
        <v-list-tile-action style="padding-right: 2px;">
          <v-icon>file</v-icon>
        </v-list-tile-action>
      </v-list-tile> -->
      <v-spacer />
    </v-list>
    <v-list
      class="non-moveable"
      style="position: absolute; bottom: 0px;"
    >
      <!-- <v-list-tile>
        <v-list-tile-action>
          <v-progress-circular indeterminate :size="20" :width="3" />
        </v-list-tile-action>
      </v-list-tile>-->
      <v-list-tile
        v-ripple
        @click="showTaskDialog"
      >
        <v-list-tile-action>
          <v-badge
            right
            :value="count !== 0"
          >
            <template #badge>
              <span>{{ count }}</span>
            </template>
            <v-icon dark>
              assignment
            </v-icon>
          </v-badge>
        </v-list-tile-action>
      </v-list-tile>
      <v-divider
        dark
        style="display: block !important;"
      />
      <v-list-tile
        push
        to="/setting"
      >
        <v-list-tile-action>
          <v-badge
            right
            :value="updateStatus !== 'none'"
          >
            <template #badge>
              <span>{{ 1 }}</span>
            </template>
            <v-icon dark>
              settings
            </v-icon>
          </v-badge>
        </v-list-tile-action>
      </v-list-tile>
    </v-list>
  </v-navigation-drawer>
</template>

<script lang=ts>
import {
  defineComponent,
} from '@vue/composition-api'
import { useDialog } from '/@/windows/main/composables'
import {
  useTaskCount,
  useUpdateInfo,
} from '/@/hooks'

export default defineComponent({
  setup() {
    const { count } = useTaskCount()
    const { show } = useDialog('task')
    const { updateStatus } = useUpdateInfo()

    return {
      updateStatus,
      count,
      showTaskDialog: show,
    }
  },
})
</script>

<style scoped>
.sidebar {
  min-width: 80px;
}
</style>
