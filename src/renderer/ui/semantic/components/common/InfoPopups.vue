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
            <i class="tasks icon"></i> {{running.length}}
        </div>
        <div class="ui flowing popup transition hidden">
            <div class="ui top attached icon label" style="display: fixed">
                <span v-if="!expanded">Running</span>
                <span v-else>All Tasks</span>

                <i style="float: right; margin: 0px" v-if="!expanded" class="expand link icon" @click="expanded = !expanded"></i>
                <i style="float: right; margin: 0px" v-else class="compress link icon" @click="expanded = !expanded"></i>
            </div>
            <div v-if="expanded" class="ui selection list" :style="taskStyle">
                <task-cell class="item" v-for="id in tasks" :key="id" :task="$store.getters['task/get'](id)">
                </task-cell>
            </div>
            <div v-if="!expanded && running.length != 0" class="ui selection list" :style="taskStyle">
                <task-cell class="item" v-for="id in running" :key="id" :task="$store.getters['task/get'](id)">
                </task-cell>
            </div>
            <div v-if="!expanded && running.length === 0">
                {{$t('tasks.empty')}}
            </div>
        </div>
    </span>
</template>

<script>
import { mapGetters } from "vuex";
export default {
    data: () => ({
        expanded: false,
    }),
    components: {
        TaskCell: () => import('./TaskCell'),
    },
    computed: {
        taskStyle() {
            if (!this.expanded)
                return {
                    'max-height': '300px',
                    'min-height': '100px',
                    'min-width': '300px',
                    overflow: 'auto',
                }
            else {
                return {
                    'min-height': '300px',
                    'max-height': '300px',
                    'max-width': '600px',
                    'min-width': '600px',
                    overflow: 'auto',
                }
            }
        },
        ...mapGetters(["errors", "errorsCount"]),
        running() {
            return this.$store.getters['task/running'];
        },
        tasks() {
            return this.$store.getters['task/all'];
        }
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
        const self = this;
        $(this.$refs.taskPopup).popup({
            on: 'click',
            position: "top center",
            delay: {
                show: 300
            },
            onHidden() {
                self.expanded = false;
            }
        });
    }
};
</script>

<style scoped="true">
.ui.top.center.popup:before {
  display: none;
}
</style>
