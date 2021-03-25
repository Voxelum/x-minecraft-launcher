<template>
  <v-navigation-drawer
    :value="true"
    :mini-variant="true"
    stateless
    dark
    style="border-radius: 2px 0 0 2px;"
    class="moveable sidebar"
  >
    <v-toolbar
      flat
      class="transparent"
    >
      <v-list class="pa-0 non-moveable">
        <v-list-tile
          avatar
          @click="goBack"
        >
          <v-list-tile-avatar>
            <v-icon dark>
              arrow_back
            </v-icon>
          </v-list-tile-avatar>
        </v-list-tile>
      </v-list>
    </v-toolbar>
    <v-list class="non-moveable">
      <v-divider
        dark
        style="display: block !important;"
      />
      <v-list-tile
        replace
        to="/"
      >
        <v-list-tile-action>
          <v-icon>home</v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <v-list-tile
        replace
        to="/instances"
      >
        <v-list-tile-action>
          <v-icon>apps</v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <v-list-tile
        replace
        to="/user"
      >
        <v-list-tile-action>
          <v-icon>person</v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <v-list-tile
        replace
        to="/curseforge"
      >
        <v-list-tile-action style="padding-right: 2px;">
          <v-icon :size="14">
            $vuetify.icons.curseforge
          </v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <!-- <v-list-tile
        replace
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
        replace
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
  reactive,
  toRefs,
  defineComponent,
} from '@vue/composition-api'
import {
  provideRouterHistory,
  useRouter,
  useTaskCount,
  useUpdateInfo,
} from '/@/hooks'
import { required } from '/@/util/props'
import { useDialog } from '../hooks'

export default defineComponent({
  props: {
    goBack: required<() => void>(Function),
  },
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

<style>
.sidebar {
  min-width: 80px;
}
</style>
