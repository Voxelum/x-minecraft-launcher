<template>
    <div class="ui center aligned grid">
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="disk outline icon"></i>
                Repository
            </h5>
            <div class="ui list">
                <list-cell v-for="entry in unselecting" :key="entry.key" :entry="entry" type="add" @change="add"></list-cell>
            </div>
        </div>
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="folder outline icon"></i>
                Using
            </h5>
            <div class="ui list">
                <list-cell v-for="entry in selecting" :key="entry.key" :entry="entry" type="remove" @change="remove"></list-cell>
            </div>
        </div>
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
            return this.entries.filter(e => this.selectingNames.indexOf(e.value.meta.packName) !== -1)
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
    },
    mounted() {
        $('#resourcepackList .item').dimmer({ on: 'hover' })
    },

}
</script>
