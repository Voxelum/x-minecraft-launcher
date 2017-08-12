<template>
    <div class="ui aligned grid" @drop="ondrop">
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="disk outline icon"></i>
                {{$t('resourcepack.available')}}
            </h5>
            <div class="ui relaxed list">
                <list-cell v-for="entry in unselecting" :key="entry.key" :entry="entry" type="add" @change="add"></list-cell>
            </div>
        </div>
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="folder outline icon"></i>
                {{$t('resourcepack.selected')}}
            </h5>
            <div class="ui relaxed list">
                <list-cell v-for="entry in selecting" :key="entry.key" :entry="entry" type="remove" @change="remove" @moveup="moveup" @movedown="movedown"></list-cell>
            </div>
        </div>
        <div v-if="this.$store.state.dragover">AUIDUSBIBIAD</div>
        
    </div>
</template>

<script>
import { remote } from 'electron'
import { mapActions, mapGetters } from 'vuex'
import ListCell from './ListCell'

export default {
    components: { ListCell },
    computed: {
        ...mapGetters('resourcepacks', ['entries']),
        ...mapGetters('profiles', ['selectedKey']),
        unselecting() {
            return this.entries.filter(e => this.selectingNames.indexOf(e.value.meta.packName) === -1)
        },
        selecting() {
            return this.selectingNames.map(name => this.nameToEntry.get(name))
        },
        nameToEntry() {
            const map = new Map()
            for (const entry of this.entries) {
                map.set(entry.value.meta.packName, entry)
            }
            return map;
        },
        selectingNames() {
            return (this.$store.getters[`profiles/${this.selectedKey}/minecraft/resourcepacks`])
        },
    },
    methods: {
        ...mapActions('resourcepacks', ['import']),
        add(pack) {
            this.$store.commit(`profiles/${this.selectedKey}/minecraft/addResourcepack`, { pack })
        },
        remove(pack) {
            this.$store.commit(`profiles/${this.selectedKey}/minecraft/removeResourcepack`, { pack })
        },
        importResourcePack() {
            const self = this;
            remote.dialog.showOpenDialog({}, (files) => {
                if (files)
                    for (const file of files)
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
