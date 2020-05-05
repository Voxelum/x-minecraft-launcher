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
import { computed, defineComponent } from '@vue/composition-api';
import { Issue } from '@universal/store/modules/diagnose';
import { useStore, useRouter, useService, useBusy } from '@/hooks';
import { useDialog } from '../hooks';

export default defineComponent({
  setup() {
    const { getters } = useStore();
    const { fix } = useService('DiagnoseService');
    const router = useRouter();
    const problems = computed(() => getters.issues);
    const problemsLevelColor = computed(() => (getters.issues.some(p => !p.optional) ? 'red' : 'warning'));
    const refreshing = useBusy('diagnose');
    const { show: showTaskDialog } = useDialog('task');
    const { show: showJavaDialog } = useDialog('java-wizard');
    const { show: showModDialog } = useDialog('download-missing-mods');

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
          showJavaDialog();
          break;
        default:
      }
    }

    function handleAutoFix() {
      fix(problems.value as any);
      showTaskDialog();
    }
    return {
      problems,
      problemsLevelColor,
      refreshing,
      fixProblem(problem: Issue) {
        if (!problem.autofix) {
          handleManualFix(problem);
        } else {
          handleAutoFix();
        }
      },
    };
  },
});
</script>

<style>
</style>
