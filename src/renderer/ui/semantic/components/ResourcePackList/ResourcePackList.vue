<template>
    <div class="ui center aligned middle aligned basic segment container" v-if="values.length===0" @drop="ondrop" style="height:100% !important">
        <br>
        <h2 class="ui icon header">
            <i class="gift icon"></i>
            <div class="sub header">{{$t('resourcepack.hint')}}</div>
        </h2>
    </div>
    <div class="ui dimmable grid" @drop="ondrop" style="height:100%" v-else>
        <div v-if="this.$store.state.dragover" class="ui inverted active dimmer">
            <div class="content">
                <div class="center">
                    <div class="sub header">{{$t('resourcepack.hint')}}</div>
                </div>
            </div>
        </div>
        <div class="eight wide column">
            <div-header>
                <i class="disk outline icon"></i>
                {{$t('resourcepack.available')}}
            </div-header>
            <div class="ui flowing popup top left transition hidden">
                <div class="ui vertical center aligned secondary menu">
                    <a class="item">
                        {{$t('resourcepack.import')}}
                        <i class="plus icon"></i>
                    </a>
                    <a class="item">
                        {{$t('resourcepack.export')}}
                        <i class="upload icon"></i>
                    </a>
                </div>
            </div>
            <div class="ui relaxed list">
                <list-cell v-for="value in unselecting" :key="value.name" :val="value" type="add" @change="add"  @delete="dele"></list-cell>
            </div>
        </div>
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="folder outline icon"></i>
                {{$t('resourcepack.selected')}}
            </h5>
            <div class="ui relaxed list">
                <list-cell v-for="value in selecting" :key="value.name" :val="value" type="remove" @change="remove" @moveup="moveup" @movedown="movedown" ></list-cell>
            </div>
        </div>
    </div>
</template>

<script>
import { remote } from 'electron'
import { mapActions, mapGetters, mapMutations } from 'vuex'
import ListCell from './ListCell'
import DivHeader from '../DivHeader'

export default {
    components: { ListCell, DivHeader },
    computed: {
        ...mapGetters('resourcepacks', ['values']),
        unselecting() {
            return this.values.filter(e => this.selectingNames.indexOf(e.name) === -1)
        },
        selecting() {
            return this.selectingNames.map(name => this.nameToEntry.get(name))
        },
        nameToEntry() {
            const map = new Map()
            for (const value of this.values) {
                if (!map.has(value.name))
                    map.set(value.name, value)
                else {
                    const name = value.name + ' copy'
                    this.rename({ resource: value, name })
                    map.set(name, value)
                }
            }
            return map;
        },
        selectingNames() {
            return this.$store.getters[`profiles/${this.id}/minecraft/resourcepacks`]
        },
    },
    methods: {
        ...mapActions('resourcepacks', ['import', 'delete']),
        ...mapMutations('resourcepacks', ['rename']),
        resourcepack(action, pack) {
            this.$store.commit(`profiles/${this.id}/minecraft/resourcepack`, { action, pack })
        },
        add(pack) { this.resourcepack('add', pack) },
        remove(pack) { this.resourcepack('remove', pack) },
        moveup(name) { this.resourcepack('moveup', name) },
        movedown(name) { this.resourcepack('movedown', name) },
        importResourcePack() {
            const self = this;
            remote.dialog.showOpenDialog({}, (files) => {
                if (files) for (const file of files)
                    self.import(file)
            })
        },
        ondrop(event) {
            this.import(event.dataTransfer.files[0].path)
            event.preventDefault()
        },
        dele(hash) {
            this.delete(hash)
        },
    },
    props: ['id'],
    mounted() {
        $('#resourcepackList .item').dimmer({ on: 'hover' })
    },

}
</script>
