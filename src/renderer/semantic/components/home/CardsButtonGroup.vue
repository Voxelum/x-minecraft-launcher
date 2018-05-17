<template>
    <span>
        <div class="ui icon right floated inverted button non-moveable" @click="onModpack">
            <i class="plus icon"></i>
            {{$t('modpack.add')}}
        </div>
        <div class="ui icon right floated inverted button non-moveable" @click="onServer">
            <i class="plus icon"></i>
            {{$t('server.add')}}
        </div>
    </span>
</template>

<script>
export default {
    methods: {
        onModpack() {
            this.$ipc.emit('modal', 'modpack')
        },
        onServer() {
            this.$ipc.emit('modal', 'server')
        }
    }
}
</script>

<style>

</style>
