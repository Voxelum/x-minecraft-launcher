<template>
    <div>
        <div class="ui button" @click="importMap">
            Import
        </div>
        <div class="ui button" @click="exportMap">
            Exprot
        </div>
        <div class="ui button" @click="copyTo">
            CopyTo
        </div>
        <div class="ui selection list">
            <list-cell v-for="map in maps" :key="map.displayName" :map="map" :id="id"></list-cell>
            <!-- <div draggable="true" class="ui item input" v-for="m in maps" :key="m.name">
                                            {{m.name}} : {{m.list}}
                                        </div> -->
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'
import types from '@/store/types'
import ListCell from './ListCell'

export default {
    components: { ListCell },
    props: ['source', 'id'],
    computed: {
        maps() {
            return this.$store.getters[`profiles/${this.id}/minecraft/maps`]
        }
    },
    methods: {
        exportMap(event) {

        },
        importMap(event) { },
        modify(event) {
        },
        copyTo(event) { },
    },
}
</script>

<style>

</style>
