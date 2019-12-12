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
import { Problem } from 'universal/store/modules/diagnose';
import { useStore, useRouter, useDialog, useNotifier, useI18n } from '@/hooks';

export default {
  setup() {
    const { getters, state, services } = useStore();
    const router = useRouter();
    const problems = computed(() => getters.problems);
    const problemsLevelColor = computed(() => (getters.problems.some(p => !p.optional) ? 'red' : 'warning'));
    const refreshing = computed(() => getters.busy('diagnose'));
    const { showDialog } = useDialog('task');
    const { showDialog: showJavaDialog } = useDialog('java-wizard');
    const { notify } = useNotifier();
    const { t } = useI18n();

    async function handleManualFix(problem: Problem) {
      switch (problem.id) {
        case 'missingModsOnServer':
          //   data.downloadMissingModsDialog = true;
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
            await services.InstanceService.editInstance({ java: state.java.all.find(j => j.majorVersion === 8) });
            notify('info', t('java.switchVersion'));
            // TODO: notify user here the launcher switch java version
          } else {
            showJavaDialog();
          }
          break;
        default:
      }
    }

    function handleAutoFix() {
      services.DiagnoseService.fixProfile(problems.value);
      showDialog();
    }
    return {
      problems,
      problemsLevelColor,
      refreshing,
      fixProblem(problem: Problem) {
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
