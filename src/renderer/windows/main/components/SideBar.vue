<template>
  <v-navigation-drawer
    :value="true"
    :mini-variant="mini"
    stateless
    dark
    style="border-radius: 2px 0 0 2px;"
    class="moveable"
    @mouseenter="onEnterBar"
    @mouseover="onHoverBar"
    @mouseleave="onLeaveBar"
  >
    <v-toolbar flat class="transparent">
      <v-list class="pa-0 non-moveable">
        <v-list-tile avatar @click="goBack">
          <v-list-tile-avatar>
            <v-icon dark>arrow_back</v-icon>
          </v-list-tile-avatar>
        </v-list-tile>
      </v-list>
    </v-toolbar>
    <v-list class="non-moveable">
      <v-divider dark style="display: block !important;" />
      <v-list-tile :disabled="!logined" replace to="/">
        <v-list-tile-action>
          <v-icon>home</v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <v-list-tile :disabled="!logined" replace to="/instances">
        <v-list-tile-action>
          <v-icon>apps</v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <v-list-tile :disabled="!logined" replace to="/user">
        <v-list-tile-action>
          <v-icon>person</v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <v-list-tile :disabled="!logined" replace to="/curseforge">
        <v-list-tile-action style="padding-right: 2px;">
          <v-icon :size="14">$vuetify.icons.curseforge</v-icon>
        </v-list-tile-action>
      </v-list-tile>
      <v-spacer />
    </v-list>
    <v-list class="non-moveable" style="position: absolute; bottom: 0px;">
      <!-- <v-list-tile>
        <v-list-tile-action>
          <v-progress-circular indeterminate :size="20" :width="3" />
        </v-list-tile-action>
      </v-list-tile>-->
      <v-list-tile v-ripple @click="showTaskDialog">
        <v-list-tile-action>
          <v-badge right :value="activeTasksCount !== 0">
            <template v-slot:badge>
              <span>{{ activeTasksCount }}</span>
            </template>
            <v-icon dark>assignment</v-icon>
          </v-badge>
        </v-list-tile-action>
      </v-list-tile>
      <v-divider dark style="display: block !important;" />
      <v-list-tile replace to="/setting">
        <v-list-tile-action>
          <v-icon dark>settings</v-icon>
        </v-list-tile-action>
      </v-list-tile>
    </v-list>
  </v-navigation-drawer>
</template>

<script lang=ts>
import {
  reactive,
  toRefs,
  createComponent,
} from '@vue/composition-api';
import {
  useRouter,
  useCurrentUserStatus,
  useTaskCount,
} from '@/hooks';
import { useDialog } from '../hooks';

export default createComponent({
  setup() {
    const { activeTasksCount } = useTaskCount();
    const { logined } = useCurrentUserStatus();
    const { show } = useDialog('task');
    const router = useRouter();

    const localHistory: string[] = [];
    let startHoverTime = -1;
    let timeTraveling = false;

    const data = reactive({
      taskDialog: false,
      mini: true,
    });

    router.afterEach((to, from) => {
      if (!timeTraveling) localHistory.push(from.fullPath);
    });
    function goBack() {
      if (!logined.value && router.currentRoute.path === '/login') {
        return;
      }
      timeTraveling = true;
      const before = localHistory.pop();
      if (before) {
        router.replace(before);
      }
      timeTraveling = false;
    }

    return {
      ...toRefs(data),
      activeTasksCount,
      showTaskDialog: show,
      goBack,
      logined,
      onEnterBar() {
        startHoverTime = Date.now();
      },
      onHoverBar() {
        if (Date.now() - startHoverTime > 1000) {
          data.mini = true;
        }
      },
      onLeaveBar() {
        startHoverTime = -1;
        data.mini = false;
      },
    };
  },
});
</script>

<style>
</style>
