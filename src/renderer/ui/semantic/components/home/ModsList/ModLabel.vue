<template>
    <a class="ui large" :class="{label:true}" style="margin:5px" :data-tooltip="mod.version" data-inverted="" :data-position="pos(index)" @click="toggle">
        <i v-if="selecting==='false'" class="plus icon"></i>
        {{mod.name}}
        <i v-if="selecting==='true'" class="close icon" @click="$emit('remove')"></i>
        <a class="detail" @click="onclick">{{$t('detail')}}</a>
    </a>
</template>

<script>
export default {
    methods: {
        pos(index) {
            return index > 7 ? 'top center' : 'bottom center'
        },
        toggle() {
            if (this.notmatch)
                this.$emit('toggle')
        },
        onclick() {
            this.$ipc.emit('modal', 'moddetail', this.mod);
            event.preventDefault();
            return false;
        },
    },
    mounted() {
    },
    props: ['mod', 'index', 'selecting', 'notmatch']
}
</script>

<style>

</style>
