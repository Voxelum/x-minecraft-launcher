<template>
    <div class="item" style="width: 100%">
        <i v-if="childs.length != 0 && !expand" @click="expand = true" class="angle right icon"></i>
        <i v-if="childs.length != 0 && expand" @click="expand = false" class="angle down icon"></i>
        <div class="content" style="width: 100%">
            <div class="header" @click="expand = !expand">{{$t(`${task.name}.name`)}}
                <i v-if="task.status==='finish'" style="float: right;" class="green check circle icon"></i>
                <div v-if="task.status==='running'" style="float: right;" class="ui active mini inline loader"></div>
                <i v-if="task.status==='error'" style="float: right" class="red exclamation circle icon"></i>
            </div>
            <div class="description" @click="expand = !expand">abc</div>
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
    props: ['task'],
    data: () => ({
        expand: false,
    }),
    computed: {
        childs() {
            return Object.keys(this.task.tasks).map(k => this.task.tasks[k]);
        },
    }
}
</script>

<style>
</style>

