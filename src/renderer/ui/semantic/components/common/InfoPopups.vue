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
                <div class="item" v-for="(moduleTask, index) in runningTasks" :key="index">
                    <div class="content">
                        <div class="header">{{$t(`${moduleTask.id}.name`)}}</div>
                        <div class="description">
                            <br>
                            <undetermined-progress v-if="moduleTask.total==-1" :active="moduleTask.status==='running'" :error="moduleTask.status==='error'" :status="$t(`${moduleTask.id}.description`)"></undetermined-progress>
                            <progress-bar v-if="moduleTask.total!=-1" :progress="moduleTask.progress" :total="moduleTask.total" :active="moduleTask.status==='running'" :error="moduleTask.status==='error'"></progress-bar>

                            <!-- {{$t(`${moduleTask.id}.description`)}} -->
                        </div>
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
    data: () => ({
        runningTasks: [],
        tasksCount:0,
    }),
    computed: {
        ...mapGetters(["errors" , "errorsCount"])
    },
    mounted() {
        $(this.$refs.warningPopup).popup({
            hoverable: true,
            position: "top center",
            delay: {
                show: 300
            },
            onShow() { }
        });
        $(this.$refs.prg).progress({
            autoSuccess: false,
            showActivity: false,
            value: 2,
            total: 2,
            label: 'ratio'
        })
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
