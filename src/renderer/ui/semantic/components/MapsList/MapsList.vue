<template>
    <div @drop="importMap">
        <div-header>
            <i class="map outline icon "></i>
            {{$tc('map.name', 0)}}
        </div-header>
        <div class="ui flowing popup top left transition hidden">
            <div class="ui vertical center aligned secondary menu">
                <a class="item">Import
                    <i class="plus icon"></i>
                </a>
                <a class="item">Exprot<i class="upload icon"></i></a>
                <a class="item">CopyTo<i class="copy icon"></i></a>
            </div>
        </div>
        <div class="ui middle aligned divided list">
            <list-cell v-for="map in maps" :key="map.displayName" :map="map" :id="id"></list-cell>
        </div>
        <div class="ui center aligned middle aligned basic segment" v-if="maps.length===0">
            <br>
            <h2 class="ui icon header">
                <i class="map icon"></i>
                <div class="sub header">{{$t('map.hint')}}</div>
            </h2>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'
import types from '@/store/types'
import ListCell from './ListCell'
import DivHeader from '../DivHeader'

export default {
    components: { ListCell, DivHeader },
    mounted() {
    },
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
