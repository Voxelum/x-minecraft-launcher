<template>
    <div class="ui basic modal" style="padding:0 20% 0 20%;">
        <div class="ui icon tiny header">
            <i class="setting icon"></i>
            {{$t('setting.name', 0)}}
        </div>
        <form class="ui inverted form">
            <div class="field">
                <label>{{$t('setting.location')}}</label>
                <div class="ui basic inverted action input" @keydown="cacnelKey">
                    <input type="text" v-model="location">
                    <div class="ui icon button" @click="browseFolder">
                        <i class="folder icon"></i>
                    </div>
                </div>
            </div>
            <div class="field">
                <label>{{$t('setting.theme')}}</label>
                <div class="ui selection dropdown">
                    <i class="dropdown icon"></i>
                    <span class="text">{{selectedTheme}}</span>
                    <div class="menu">
                        <div class="item" v-for="th of themes" :key="th" @click="updateTheme(th)">{{th}}</div>
                    </div>
                </div>
            </div>
            <div class="field">
                <label>{{$t('setting.language')}}</label>
                <div class="ui selection dropdown">
                    <i class="dropdown icon"></i>
                    <span class="text">{{selectedLanguage}}</span>
                    <div class="menu">
                        <div class="item" v-for="l of languages" :key="l" @click="updateLanguage(l)">{{l}}</div>
                    </div>
                </div>
            </div>
            <div class="field" :class="{disabled: resfullscreen}">
                <label>{{$t('setting.resolution')}}</label>
                <div class="two fields">
                    <div class="field">
                        <input class="ui basic inverted input" type="text" v-model="reswidth" :placeholder="$t('resolution.width')">
                    </div>
                    <div class="field">
                        <input class="ui basic inverted input" type="text" v-model="resheight" :placeholder="$t('resolution.height')">
                    </div>
                </div>
            </div>
            <div class="inline field">
                <div class="ui slider checkbox" @click="resfullscreen=!resfullscreen">
                    <input type="checkbox" name="auto-download">
                    <label>{{$t('resolution.fullscreen')}}</label>
                </div>
            </div>
            <div class="ui inverted right floated button" @click="upload">{{$t('save')}}</div>
            <div class="ui inverted right floated button" @click="discard">{{$t('cancel')}}</div>
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
            selectedLanguage: '',
        }
    },
    computed: {
        ...vuex.mapGetters('appearance', ['theme', 'themes']),
        ...vuex.mapGetters([
            'root',
            // 'autoDownload',
            // 'javas',
            // 'defaultJava',
            'languages',
            'language']),
    },
    mounted() {
        $(this.$el).modal({ blurring: true, })
        $('.selection.dropdown').dropdown()
    },
    methods: {
        ...vuex.mapActions(['openDialog', 'updateSetting']),
        show() {
            // this.resheight = this.defaultResolution.height;
            // this.reswidth = this.defaultResolution.width;
            // this.resfullscreen = this.defaultResolution.fullscreen;
            this.location = this.root;
            this.selectedTheme = this.theme;
            this.selectedLanguage = this.language;
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
        updateTheme(theme) {
            this.selectedTheme = theme;
        },
        updateLanguage(lang) {
            this.selectedLanguage = lang;
        },
        discard() {
            $(this.$el).modal('hide')
        },
        upload(e) {
            this.updateSetting({
                resolution: {
                    width: this.reswidth,
                    height: this.resheight,
                    fullscreen: this.resfullscreen,
                },
                location: this.location,
                theme: this.selectedTheme,
                language: this.selectedLanguage,
            });
            $(this.$el).modal('hide')
        },
    }
}
</script>

<style>

</style>
