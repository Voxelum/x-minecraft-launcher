<template>
    <span>
        <div class="ui icon right floated inverted button non-moveable" @click="onLaunch">
            &nbsp&nbsp&nbsp
            <i class="rocket icon"></i>
            {{$t('launch')}} &nbsp&nbsp&nbsp&nbsp
        </div>
        <div class="ui icon right floated inverted button non-moveable" @click="edit">
            <i class="edit icon"></i>
            {{$t('edit')}}
        </div>
    </span>
</template>

<script>
export default {
    computed: {
        id() { return this.$route.params.id },
        type() { return this.$store.getters[`profiles/${this.id}/type`] }
    },
    methods: {
        edit() {
            this.$ipc.emit('modal', this.type, { isEdit: true })
        },
        onLaunch() {
            this.$store.dispatch('launch', this.id);
            // this.launch(this.id).catch((e) => {
            //     if (e.type) switch (e.type) {
            //         case 'NoSelectedVersion':
            //             this.$ipc.emit('modal', 'generic', {
            //                 icon: 'exclamation',
            //                 header: this.$t('version.selectVersion'),
            //                 content: this.$t('version.selectversionWarn'),
            //             })
            //             break;
            //         case 'MissingMinecraftVersion':
            //             this.$ipc.emit('modal', 'missingVersion', {
            //                 type: 'minecraft',
            //                 version: e.version
            //             })
            //             break;
            //         case 'MissingForgeVersion':
            //             this.$ipc.emit('modal', 'missingVersion', {
            //                 type: 'forge',
            //                 version: e.version
            //             })
            //             break;
            //         case 'MissingLiteloaderVersion':
            //             this.$ipc.emit('modal', 'missingVersion', {
            //                 type: 'liteloader',
            //                 version: e.version
            //             })
            //             break;
            //         default:
            //     }
            // })
        },
    },
}
</script>

<style>

</style>
