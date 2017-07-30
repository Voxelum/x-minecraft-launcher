<template>
    <div>
        <div class="ui button" @click="importResourcePack">Import</div>
        <div class="ui list">
            <div class="item" v-for="pack in unselectingResources" :key="pack">
                <div class="right floated content">
                    <div class="ui button" @click="moveRight">
                        <i class="arrow right icon"></i>
                    </div>
                </div>
                <i class="map marker icon"></i>
                <div class="content">
                    <div class="header">{{key.name}}</div>
                    <div class="description"> {{key.description}}</div>
                </div>
            </div>
            <div class="item">
                <div class="right floated content">
                    <div class="ui button">
                        <i class="arrow right icon"></i>
                    </div>
                </div>
                <i class="map marker icon"></i>
                <div class="content">
                    <div class="header">Xian Famous Foods</div>
                    <div class="description">A pack bring xxx exp to mc.</div>
                </div>
            </div>
        </div>
        <div class="ui list">
            <div class="item" v-for="pack in selectingResources" :key="pack">
                <div class="left floated content">
                    <div class="ui button" @click="moveLeft">
                        <i class="arrow left icon"></i>
                    </div>
                </div>
                <i class="map marker icon"></i>
                <div class="content">
                    <div class="header">{{key.name}}</div>
                    <div class="description"> {{key.description}}</div>
                </div>
            </div>
            <div class="item">
                <div class="left floated content">
                    <div class="ui button">
                        <i class="arrow left icon"></i>
                    </div>
                </div>
                <i class="map marker icon"></i>
                <div class="content">
                    <div class="header">Xian Famous Foods</div>
                    <div class="description">A pack bring xxx exp to mc.</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { remote } from 'electron'
import { mapActions, mapGetters } from 'vuex'

export default {
    computed: {
        ...mapActions('resourcepacks', 'import'),
        ...mapGetters('resourcepacks', 'all'),
        ...mapGetters('profiles', 'selecting'),
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
        importResourcePack() {
            remote.dialog.showOpenDialog({}, (files) => {

            })
        },
    }

}
</script>
