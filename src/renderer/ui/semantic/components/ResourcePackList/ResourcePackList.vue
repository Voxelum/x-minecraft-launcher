<template>
    <div class="ui dimmable grid" @drop="ondrop">
        <div v-if="this.$store.state.dragover" class="ui inverted active dimmer">
            <div class="content">
                <div class="center">
                    Drag here to import
                </div>
            </div>
        </div>
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="disk outline icon"></i>
                {{$t('resourcepack.available')}}
            </h5>
            <div class="ui relaxed list">
                <list-cell v-for="value in unselecting" :key="value.name" :val="value" type="add" @change="add"></list-cell>
            </div>
        </div>
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="folder outline icon"></i>
                {{$t('resourcepack.selected')}}
            </h5>
            <div class="ui relaxed list">
                <list-cell v-for="value in selecting" :key="value.name" :val="value" type="remove" @change="remove" @moveup="moveup" @movedown="movedown"></list-cell>
            </div>
        </div>
    </div>
</template>

<script>
import { remote } from 'electron'
import { mapActions, mapGetters, mapMutations } from 'vuex'
import ListCell from './ListCell'

export default {
    components: { ListCell },
    computed: {
        ...mapGetters('resourcepacks', ['values']),
        ...mapGetters('profiles', ['selectedKey']),
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
            return (this.$store.getters[`profiles/${this.selectedKey}/minecraft/resourcepacks`])
        },
    },
    methods: {
        ...mapActions('resourcepacks', ['import']),
        ...mapMutations('resourcepacks', ['rename']),
        add(pack) {
            this.$store.commit(`profiles/${this.selectedKey}/minecraft/addResourcepack`, { pack })
        },
        remove(pack) {
            this.$store.commit(`profiles/${this.selectedKey}/minecraft/removeResourcepack`, { pack })
        },
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
        moveup(name) {
            this.$store.commit(`profiles/${this.selectedKey}/minecraft/moveupResourcepack`, { pack: name })
        },
        movedown(name) {
            this.$store.commit(`profiles/${this.selectedKey}/minecraft/movedownResourcepack`, { pack: name })
        },
    },
    mounted() {
        $('#resourcepackList .item').dimmer({ on: 'hover' })
    },

}
</script>
