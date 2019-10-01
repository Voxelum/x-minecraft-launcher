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

<script>
import { useStore, useRouter } from '@/hooks';
import { computed } from '@vue/composition-api';

export default {
  setup() {
    const { getters, state, dispatch } = useStore();
    const router = useRouter();
    const problems = computed(() => getters.problems);
    const problemsLevelColor = computed(() => (getters.problems.some(p => !p.optional) ? 'red' : 'warning'));
    const refreshing = computed(() => state.profile.refreshing);

    async function handleManualFix(problem) {
      let handle;
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
            await dispatch('editProfile', { java: state.java.all.find(j => j.majorVersion === 8) });
            // TODO: notify user here the launcher switch java version
          } else {
            // data.javaWizardDialog = true;
          }
          break;
        default:
      }
    }

    function handleAutoFix() {
      dispatch('fixProfile', problems.value);
    }
    return {
      problems,
      problemsLevelColor,
      refreshing,
      fixProblem(problem) {
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
