<template>
    <span class="non-moveable ui inverted basic icon buttons">
        <div ref="warningPopup" class="ui button">
            <i class="warning sign icon"></i> {{errorsCount}}
        </div>
        <div class="ui flowing popup transition hidden">
            <div v-if="errorsCount != 0" class="ui middle aligned divided list" style="max-height:300px; min-width:300px; overflow:hidden">
                <div v-for="(moduleErr, index) in errors" :key='index' class="item">
                    {{index}}
                    <div class="ui middle aligned selection divided list">
                        <div v-for="err of moduleErr" :key="err" class="item">
                            <div class="item">
                                <i class="warning icon"></i> {{$t(`error.${err}`)}}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div v-else>
                {{$t('errors.empty')}}
            </div>
        </div>
        <div ref="taskPopup" class="ui button">
            <i class="tasks icon"></i> {{tasksCount}}
        </div>
        <div class="ui flowing popup transition hidden">
            <div v-if="tasksCount != 0" class="ui middle aligned divided list" style="max-height:300px; min-width:300px; overflow:hidden">
                <div class="item">
                    <div class="content">
                        <div class="header">Ping Server</div>
                        <div class="description">Pingning server</div>
                        <div class="ui active progress">
                            <div class="bar">
                                <div class="progress"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-for="(moduleTask, index) in runningTasks" :key='index' class="item">
                    <i class="task icon"></i>
                    <div class="content">
                        <div class="ui basic label">{{moduleTask.status}}</div>
                        <div class="header">{{$t(moduleTask.id)}}</div>
                        <!-- <div class="ui progress">
                            <div class="bar">
                                <div class="progress"></div>
                            </div>
                            <div class="label">Uploading Files</div>
                        </div> -->
                    </div>
                </div>
            </div>
            <div v-else>
                {{$t('tasks.empty')}}
            </div>
        </div>
    </span>
</template>

<script>
import { mapGetters } from "vuex";
export default {
  computed: {
    ...mapGetters(["errors", "runningTasks", "errorsCount", "tasksCount"])
  },
  mounted() {
      $('.progress').progress();
    $(this.$refs.warningPopup).popup({
      hoverable: true,
      position: "top center",
      delay: {
        show: 300
      },
      onShow() {}
    });
    $(this.$refs.taskPopup).popup({
      hoverable: true,
      position: "top center",
      delay: {
        show: 300
      }
    });
  }
};
</script>

<style>

</style>
