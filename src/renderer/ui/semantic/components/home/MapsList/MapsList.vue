<template>
    <div class="ui center aligned middle aligned basic segment" v-if="maps.length===0" @drop="importMap" @mousedown="importMap" style="height:100%">
        <br>
        <h2 class="ui icon header">
            <i class="map icon"></i>
            <div class="sub header">{{$t('map.hint')}}</div>
        </h2>
    </div>
    <div @drop="importMap" v-else>
        <div-header>
            <i class="map outline icon "></i>
            {{$tc('map.name', 0)}}
        </div-header>
        <div class="ui flowing popup top left transition hidden">
            <div class="ui vertical center aligned secondary menu">
                <a class="item" @click="importDialog">
                    {{$t('map.import')}}
                    <i class="plus icon"></i>
                </a>
            </div>
        </div>
        <div class="ui divided items">
            <list-cell v-for="map in maps" :key="map.displayName" :map="map" :id="id" @remove="deleteMap" @export="exportMap">
            </list-cell>
        </div>
    </div>
</template>


<script>
import vuex from 'vuex'

export default {
    components: {
        ListCell: () => import('./ListCell')
    },
    mounted() {
    },
    computed: {
        id() { return this.$route.params.id },
        maps() { return this.$store.getters[`profiles/${this.id}/map/all`] || [] }
    },
    methods: {
        ...vuex.mapActions(['saveDialog', 'openDialog']),
        importDialog() {
            this.openDialog().then((files) => {
                this.$store.dispatch(`profiles/${this.id}/map/import`, files)
            })
        },
        importMap(event) {
            if (!event.dataTransfer) return;
            this.$store.dispatch(`profiles/${this.id}/map/import`,
                Array.from(event.dataTransfer.files).map(f => f.path))
        },
        deleteMap(map) {
            this.$ipc.emit('modal', 'deleteMap', { id: this.id, map })
        },
        exportMap(map) {
            this.saveDialog({ title: 'Export map to', defaultPath: `${map.filename}` })
                .then((file) => {
                    this.$store.dispatch(`profiles/${this.id}/map/export`,
                        { map: map.filename, file })
                })
        },
    },
}
</script>

<style>

</style>
