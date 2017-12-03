<template>
    <a class="ui large label" style="margin:5px" :data-tooltip="mod.version" data-inverted="" :data-position="pos(index)" @click="$emit('toggle')">
        <i v-if="selecting==='false'" class="plus icon"></i>
        {{mod.name}}
        <i v-if="selecting==='true'" class="close icon" @click="$emit('remove')"></i>
        <a class="detail" @click="onclick">Detail</a>
    </a>
</template>

<script>
export default {
    methods: {
        pos(index) {
            return index > 7 ? 'top center' : 'bottom center'
        },
        onclick() {
            this.$ipc.emit('modal', 'moddetail', this.mod);
            event.preventDefault();
            return false;
        },
    },
    props: ['mod', 'index', 'selecting']
}
</script>

<style>

</style>
