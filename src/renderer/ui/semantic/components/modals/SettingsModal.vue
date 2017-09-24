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
                    <div class="default text">Semantic</div>
                    <div class="menu">
                        <div class="item" data-value="1">Semantic</div>
                        <div class="item" data-value="0">Material</div>
                    </div>
                </div>
            </div>
            <div class="field">
                <label>Default Resolution</label>
                <div class="two fields">
                    <div class="field">
                        <input class="ui basic inverted input" type="text" placeholder="Width">
                    </div>
                    <div class="field">
                        <input class="ui basic inverted input" type="text" placeholder="Height">
                    </div>
                </div>
            </div>
            <div class="inline field">
                <div class="ui toggle inverted checkbox">
                    <input type="checkbox" name="auto-download">
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
            location: this.$store.state.root,
        }
    },
    computed: {
        ...vuex.mapState(['defaultResolution', 'autoDownload', 'theme'])
    },
    mounted() {
        $(this.$el).modal({ blurring: true, })
        $('.selection.dropdown').dropdown()
    },
    methods: {
        ...vuex.mapActions(['openDialog']),
        show() {
            $(this.$el).modal('show')
            $('.ui.checkbox').checkbox()
            $('.selection.dropdown').dropdown()
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
