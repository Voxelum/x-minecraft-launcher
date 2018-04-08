<template>
    <a class="ui large" :class="{label:true}" style="margin:5px" :data-tooltip="mod.version" data-inverted="" :data-position="pos(index)">
        <i v-if="selecting==='false'" class="plus icon" @click="toggle"></i>
        <i v-if="selecting==='true'" class="reply icon" @click="$emit('remove')"></i>
        {{mod.name}}
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
