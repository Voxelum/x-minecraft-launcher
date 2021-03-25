<template>
  <v-dialog v-model="isShown">
    <v-toolbar color="primary">
      {{ $t('mod.missing.downloadTitle') }}
    </v-toolbar>
    <v-card>
      <v-card-text>
        {{ $t('mod.missing.downloadDescription') }}
        <!-- We are trying to resolve the mod from my self host server.
        <br>
        And the launcher will download the mods if it's found on the server.
        <br>
        Otherwise, you will have to download it by yourself. (You can use curseforge.) -->
      </v-card-text>
      <v-list>
        <v-list-tile
          v-for="item in items"
          :key="`${item.modid}:${item.version}`"
        >
          <v-list-tile-content>
            <v-list-tile-title>{{ item.modid }}</v-list-tile-title>
            <v-list-tile-title>{{ item.version }}</v-list-tile-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-chip>
              {{ $t(`mod.missing.${item.status}`) }}
              <v-icon>{{ icons[item.status] }}</v-icon>
            </v-chip>
            <v-progress-circular
              :width="2"
              :size="20"
              indeterminate
            />
          </v-list-tile-action>
        </v-list-tile>
      </v-list>
      <v-card-actions>
        <v-btn
          flat
          @click="checkAvailabilities"
        >
          {{ $t('mod.missing.checkAvailabilities') }}
        </v-btn>
        <v-spacer />
        <v-btn
          flat
          :disabled="!canDownload"
        >
          {{ $t('mod.missing.downloadAll') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { defineComponent, computed } from '@vue/composition-api'
// import { useDialogSelf } from '/@/hooks';

export default defineComponent({
  setup() {
    // const { isShown, dialogOption } = useDialogSelf('download-missing-mods');
    // const items = computed(() => (dialogOption.value ? dialogOption.value.map((i: any) => ({ ...i, status: 'unknown', task: '' })) : []));
    // const canDownload = computed(() => items.value.some((i: { status: string }) => i.status === 'founded'));

    // async function checkAvailability(mod: { status: string }[]) {
    //   // await new Promise((resolve, reject) => {
    //   //   setTimeout(() => resolve(), 2000);
    //   // });
    //   for (const m of mod) {
    //     m.status = 'existed';
    //   }
    // }
    // async function checkAvailabilities() {
    //   const unchecked = [];
    //   for (const i of dialogOption.value) {
    //     if (i.status !== 'loading') {
    //       i.status = 'loading';
    //       unchecked.push(i);
    //     }
    //   }
    //   await checkAvailability(unchecked);
    // }
    // return {
    //   items,
    //   checkAvailabilities,
    //   canDownload,
    //   icons: {},
    //   isShown,
    // };
  },
})
</script>

<style>
</style>
