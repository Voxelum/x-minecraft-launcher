<template>
  <v-menu v-show="refreshing || problems.length !== 0" offset-y top dark max-height="300">
    <v-btn slot="activator" style="position: absolute; left: 200px; bottom: 10px; " :loading="refreshing"
           :flat="problems.length !== 0" outline dark :color="problemsLevelColor">
      <v-icon left dark :color="problemsLevelColor">
        {{ problems.length !== 0 ?
          'warning' : 'check_circle' }}
      </v-icon>
      {{ $tc('diagnosis.problem', problems.length, { count: problems.length }) }}
    </v-btn>

    <v-list>
      <template v-for="(item, index) in problems">
        <v-list-tile :key="index" ripple @click="fixProblem(item)">
          <v-list-tile-content>
            <v-list-tile-title>
              {{ $tc(`diagnosis.${item.id}`, item.arguments.count || 0, item.arguments) }}
            </v-list-tile-title>
            <v-list-tile-sub-title>
              {{ $t(`diagnosis.${item.id}.message`, item.arguments || {}) }}
            </v-list-tile-sub-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-icon> {{ item.autofix ? 'build' : 'arrow_right' }} </v-icon>
          </v-list-tile-action>
        </v-list-tile>
      </template>
    </v-list>
  </v-menu>
</template>

<script lang=ts>
import { computed } from '@vue/composition-api';
import { Issue } from 'universal/store/modules/diagnose';
import { useStore, useRouter, useDialog, useNotifier, useI18n } from '@/hooks';

export default {
  setup() {
    const { getters, state, services, commit } = useStore();
    const router = useRouter();
    const problems = computed(() => getters.issues);
    const problemsLevelColor = computed(() => (getters.issues.some(p => !p.optional) ? 'red' : 'warning'));
    const refreshing = computed(() => getters.busy('diagnose'));
    const { showDialog: showTaskDialog } = useDialog('task');
    const { showDialog: showJavaDialog } = useDialog('java-wizard');
    const { showDialog: showModDialog } = useDialog('download-missing-mods');
    const { notify } = useNotifier();
    const { $t } = useI18n();

    async function handleManualFix(problem: Issue) {
      switch (problem.id) {
        case 'missingModsOnServer':
          showModDialog();
          break;
        case 'unknownMod':
        case 'incompatibleMod':
          router.replace('/mod-setting');
          break;
        case 'incompatibleResourcePack':
          router.replace('/resource-pack-setting');
          break;
        case 'incompatibleJava':
          if (state.java.all.some(j => j.majorVersion === 8)) {
            commit('instanceJava', state.java.all.find(j => j.majorVersion === 8)!.path);
            await services.InstanceService.editInstance({ java: '8' });
            notify('info', $t('java.switchVersion'));
          } else {
            showJavaDialog();
          }
          break;
        default:
      }
    }

    function handleAutoFix() {
      services.DiagnoseService.fix(problems.value);
      showTaskDialog();
    }
    return {
      problems,
      problemsLevelColor,
      refreshing,
      fixProblem(problem: Issue) {
        console.log('Try to fix problem:');
        console.log(problem);
        if (!problem.autofix) {
          handleManualFix(problem);
        } else {
          handleAutoFix();
        }
      },
    };
  },
};
</script>

<style>
</style>
