<template>
    <div class="item" style="width: 100%">
        <i v-if="canRemove" class="cross icon close"></i>
        <i v-if="childs.length != 0 && !expand" @click="expand = true" class="angle right icon"></i>
        <i v-if="childs.length != 0 && expand" @click="expand = false" class="angle down icon"></i>
        <div class="content" style="width: 100%">
            <div class="header" @click="expand = !expand">{{$t(`${task.name}.name`)}}
                <span v-if="task.status==='running'">{{progress}}</span>
                <i v-if="task.status==='finish'" style="float: right;" class="green check circle icon"></i>
                <div v-else-if="task.status==='running'" style="float: right;" class="ui active mini inline loader"></div>
                <i v-else style="float: right" class="red exclamation circle icon"></i>
            </div>
            <div class="description" @click="expand = !expand">{{task.description}}</div>
            <div class="list" v-if="childs.length != 0 && expand">
                <task-cell v-for="task in childs" :key="task.id" :task="task">
                </task-cell>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'task-cell',
    props: ['task', 'canRemove'],
    data: () => ({
        expand: false,
    }),
    computed: {
        progress() {
            return (this.task.progress + 0.0) / this.task.total
        },
        childs() {
            return Object.keys(this.task.tasks).map(k => this.task.tasks[k]);
        },
    }
}
</script>

<style>

</style>

