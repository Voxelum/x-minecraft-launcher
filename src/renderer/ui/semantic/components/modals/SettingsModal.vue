<template>
    <div class="ui basic modal" style="padding:0 20% 0 20%;">
        <div class="ui icon tiny header">
            <i class="setting icon"></i>
            Settings
        </div>
        <form class="ui inverted form">
            <div class="field">
                <label>Store Location</label>
                <div class="ui basic inverted action input" @keydown="cacnelKey">
                    <input type="text" v-model="location">
                    <div class="ui icon button" @click="browseFolder">
                        <i class="folder icon"></i>
                    </div>
                </div>
            </div>
            <div class="field">
                <label>Theme</label>
                <div class="ui selection dropdown">
                    <input type="hidden" name="theme">
                    <i class="dropdown icon"></i>
                    <div class="default text">{{selectedTheme}}</div>
                    <div class="menu">
                        <div class="item" v-for="th of themes" :key="th">{{th}}</div>
                    </div>
                </div>
            </div>
            <div class="field">
                <label>Default Resolution</label>
                <div class="two fields">
                    <div class="field">
                        <input class="ui basic inverted input" type="text" v-model="reswidth" placeholder="Width">
                    </div>
                    <div class="field">
                        <input class="ui basic inverted input" type="text" v-model="resheight" placeholder="Height">
                    </div>
                </div>
            </div>
            <div class="inline field">
                <div class="ui toggle inverted checkbox">
                    <input type="checkbox" name="auto-download" v-model="resfullscreen">
                    <label>FullScreen</label>
                </div>
            </div>
            <button class="ui inverted right floated button" @click="save">Save</button>
        </form>
    </div>
</template>

<script>
import vuex from 'vuex'

export default {
    data() {
        return {
            reswidth: 400,
            resheight: 400,
            resfullscreen: false,
            location: '',
            selectedTheme: '',
        }
    },
    computed: {
        ...vuex.mapState(['defaultResolution', 'autoDownload', 'theme', 'root', 'themes'])
    },
    mounted() {
        $(this.$el).modal({ blurring: true, })
        $('.selection.dropdown').dropdown()
    },
    methods: {
        ...vuex.mapActions(['openDialog']),
        show() {
            this.resheight = this.defaultResolution.height;
            this.reswidth = this.defaultResolution.width;
            this.resfullscreen = this.defaultResolution.fullscreen;
            this.location = this.root;
            this.selectedTheme = this.theme;
            $(this.$el).modal('show')
            $('.ui.checkbox').checkbox()
            $('.selection.dropdown').dropdown()
            console.log(this)
        },
        browseFolder() {
            const self = this;
            this.openDialog({ properties: ['openDirectory', 'createDirectory'] }).then(files => {
                self.location = files[0] || self.location;
            })
        },
        cacnelKey(e) {
            e.preventDefault();
        },
        save() {

        },
    }
}
</script>

<style>

</style>
