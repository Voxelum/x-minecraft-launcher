<template>
    <div class="ui center aligned middle aligned basic segment" v-if="maps.length===0" @drop="importMap" @mousedown="importMap" style="height:100%">
        <br>
        <h2 class="ui icon header">
            <i class="map icon"></i>
            <div class="sub header">{{$t('world.hint')}}</div>
        </h2>
    </div>
    <div @drop="importMap" style="height:100%" v-else>
        <div class="ui divided items">
            <list-cell v-for="map in maps" :key="map.displayName" :map="map" :id="id" @remove="deleteMap" @export="exportMap">
            </list-cell>
        </div>
    </div>
</template>


<script>
import vuex from 'vuex'

export default {
    data: () => ({
    }),
    components: {
        ListCell: () => import('./ListCell')
    },
    mounted() {

    },
    computed: {
        id() { return this.$route.params.id },
        maps() { return this.$store.getters[`profiles/${this.id}/maps`] || [] },
    },
    methods: {
        importDialog() {
            this.$openDialog.then((files) => {
                this.$store.dispatch(`profiles/${this.id}/importMap`, files)
            })
        },
        importMap(event) {
            if (!event.dataTransfer) return;
            this.$store.dispatch(`profiles/${this.id}/importMap`,
                Array.from(event.dataTransfer.files).map(f => f.path))
        },
        deleteMap(map) {
            const self = this;
            this.$ipc.emit('modal', 'generic', {
                icon: 'map',
                header: this.$t('world.delete.header'),
                content: this.$t('world.delete.content'),
                acceptColor: 'red',
                acceptIcon: 'trash',
                accept: this.$t('delete.yes'),
                denyIcon: 'close',
                deny: this.$t('delete.no'),
                onAccept() {
                    self.$store.dispatch(`profiles/${self.id}/map/delete`, map)
                }
            })
        },
        exportMap(map) {
            this.$store.dispatch('saveDialog', {
                title: 'Export map to',
                defaultPath: `${map.filename}`,
                filters: [{
                    name: 'directory',
                    extensions: [''],
                }]
            }).then((file) => {
                if (!file || file.length === 0) return;
                this.$store.dispatch(`profiles/${this.id}/exportMap`,
                    { map: map.filename, file })
            })
        },
    },
}
</script>

<style>

</style>
