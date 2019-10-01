<template>
  <v-dialog v-model="isShown">
    <v-toolbar color="primary">
      Download Missing Server Mods
    </v-toolbar>
    <v-card>
      <v-card-text>
        We are trying to resolve the mod from my self host server.
        <br>
        And the launcher will download the mods if it's found on the server.
        <br>
        Otherwise, you will have to download it by yourself. (You can use curseforge.)
      </v-card-text>
      <v-list>
        <v-list-tile v-for="item in items" :key="`${item.modid}:${item.version}`">
          <v-list-tile-content>
            <v-list-tile-title>{{ item.modid }}</v-list-tile-title>
            <v-list-tile-title>{{ item.version }}</v-list-tile-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-chip>
              {{ $t(`mod.${item.status}`) }}
              <v-icon>{{ icons[item.status] }}</v-icon>
            </v-chip>
            <v-progress-circular :width="2"
                                 :size="20" 
                                 indeterminate />
          </v-list-tile-action>
        </v-list-tile>
      </v-list>
      <v-card-actions>
        <v-btn flat @click="checkAvailabilities">
          {{ $t('mod.checkAvailabilities') }}
        </v-btn>
        <v-spacer />
        <v-btn flat :disabled="!canDownload">
          {{ $t('mod.downloadAll') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { reactive, createComponent, computed, toRefs } from '@vue/composition-api';
import { useDialogSelf } from '@/hooks';

export default createComponent({
  setup(props) {
    const { isShown, dialogOption } = useDialogSelf('download-missing-mods');
    const icons = {
      existed: 'done',
      absent: 'clear',
    };
    const state = reactive({
      items: props.items.map(i => ({ ...i, status: 'unknown', task: '' })),
    });
    const canDownload = computed(() => state.items.some(i => i.status === 'existed'));

    async function checkAvailability(mod) {
      // await new Promise((resolve, reject) => {
      //   setTimeout(() => resolve(), 2000);
      // });
      for (const m of mod) {
        m.status = 'existed';
      }
    }
    async function checkAvailabilities() {
      const unchecked = [];
      for (const i of dialogOption.value) {
        if (i.status !== 'loading') {
          i.status = 'loading';
          unchecked.push(i);
        }
      }
      await checkAvailability(unchecked);
    }
    return {
      ...toRefs(state),
      checkAvailabilities,
      canDownload,
      icons,
      isShown,
    };
  },
});
</script>

<style>
</style>
