<template>
    <div class="ui center aligned middle aligned basic segment container" v-if="resourcepacks.length===0" @drop="ondrop" style="height:100% !important">
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
            <h5 class="ui horizontal divider header">
                <i class="disk outline icon"></i>
                {{$t('resourcepack.available')}}
            </h5>
            <div class="ui relaxed list">
                <list-cell v-for="value in unselecting" :key="value.name" :val="value" type="add" @change="add" @delete="ondelete" @export="onexport"></list-cell>
            </div>
        </div>
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="folder outline icon"></i>
                {{$t('resourcepack.selected')}}
            </h5>
            <div class="ui relaxed list">
                <list-cell v-for="value in selecting" :key="value.name" :val="value" type="remove" @change="$remove" @moveup="moveup" @movedown="movedown" @export="onexport"></list-cell>
            </div>
        </div>
    </div>
</template>

<script>
import { remote } from 'electron'
import { mapActions, mapGetters, mapMutations } from 'vuex'

export default {
    data: () => ({
        drag: false,
        isEditing: false,
    }),
    components: { ListCell: () => import('./ListCell') },
    computed: {
        ...mapGetters('repository', ['resourcepacks']),
        unselecting() {
            return this.resourcepacks.filter(e => this.selectingNames.indexOf(e.name) === -1)
        },
        selecting() {
            return this.selectingNames.map(name => this.nameToEntry[name]) || []
        },
        selectingNames() {
            return this.$store.getters[`profiles/${this.$route.params.id}/settings/resourcepacks`]
        },
        nameToEntry() {
            const map = {}
            for (const value of this.resourcepacks) {
                if (!map[value.name]) map[value.name] = value
                else {
                    const name = value.name + ' copy'
                    this.rename({ resource: value, name })
                    map[name] = value
                }
            }
            return map;
        },

    },
    methods: {
        ...mapActions(['openDialog']),
        ...mapActions('repository', ['import', 'remove', 'rename', 'exports']),
        resourcepack(action, pack) {
            this.$store.commit(`profiles/${this.$route.params.id}/settings/resourcepack`,
                { action, pack })
        },
        add(pack) { this.resourcepack('add', pack) },
        $remove(pack) { this.resourcepack('remove', pack) },
        moveup(name) { this.resourcepack('moveup', name) },
        movedown(name) { this.resourcepack('movedown', name) },
        onexport(hash) {
            const self = this;
            this.openDialog({ properties: ['openDirectory'] }).then((dir) => {
                if (dir.length === 0) return;
                self.$store.dispatch('repository/exports',
                    { targetDirectory: dir[0], resource: hash });
            })
        },
        importResourcePack() {
            this.openDialog({
                filters: [{ name: 'Resource Packs', extensions: ['zip'] }],
                properties: ['multiSelections'],
            }).then((files) => {
                if (files.length === 0) return;
                this.import(files)
            })
        },
        ondrop(event) {
            this.import(Array.from(event.dataTransfer.files).map(f => f.path))
                .catch((e) => {
                    console.error(e)
                })
        },
        ondelete(hash) {
            const self = this;
            this.$ipc.emit('modal', 'generic', {
                icon: 'trash',
                header: this.$t('resourcepack.delete.header'),
                content: this.$t('resourcepack.delete.content'),
                acceptColor: 'red',
                acceptIcon: 'trash',
                accept: this.$t('delete'),
                onAccept() {
                    self.remove(hash);
                }
            })
        },
    },
    mounted() {
        $('#resourcepackList .item').dimmer({ on: 'hover' })
    },

}
</script>
