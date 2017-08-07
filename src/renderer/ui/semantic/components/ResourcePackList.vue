<template>
    <div>
        <div class="ui button" @click="importResourcePack">Import</div>
        <div class="ui relaxed list">
            <div class="item" v-for="entry in entries" :key="entry.key">
                <div class="right floated content">
                    <div class="ui button">Add</div>
                </div>
                <img class="ui avatar image" :src="entry.value.meta.icon">
                <div class="content">
                    <h3 class="header">{{entry.value.meta.packName}}</h3>
                    <div class="description">
                        <text-component :source="entry.value.meta.description"></text-component>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { remote } from 'electron'
import { mapActions, mapGetters } from 'vuex'
import TextComponent from './TextComponent'

export default {
    components: { TextComponent },
    computed: {
        ...mapGetters('resourcepacks', ['entries']),
        ...mapGetters('profiles', ['selecting']),
        unselectingResources() {
            return []
            // return this.all.filter(a => this.selectingResources.indexOf(a) == -1)
        },
        selectingResources() {
            // console.log(this.selecting.resourcepacks)
            return []//this.selecting.resourcepacks
        },
    },
    methods: {
        ...mapActions('resourcepacks', ['import']),
        moveRight() { console.log(this.entries) },
        moveLeft() {
            console.log(this.entries)
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
    },

}
</script>
