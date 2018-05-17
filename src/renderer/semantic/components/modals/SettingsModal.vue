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
                    <span class="text">{{localeToLanguage(locale)}}</span>
                    <div class="menu">
                        <div class="item" v-for="l of locales" :key="l" @click="locale = l">{{l}}</div>
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
                <div ref="fullScreen" class="ui slider checkbox" @click="resfullscreen=!resfullscreen">
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
import { remote } from 'electron'

/**
 * Hard code mapping language
 */
const $localeToLanguage = {
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    en: 'English',
    'en-US': 'English (The United State)',
    'en-UK': 'English (The United Kindom)',
}

export default {
    data() {
        return {
            reswidth: 400,
            resheight: 400,
            resfullscreen: false,

            selectedTheme: '',
            location: '',
            locale: '',
        }
    },
    computed: {
        ...vuex.mapState('appearance', ['theme', 'themes']),
        locales() {
            return Object.keys(this.$i18n.messages).map(k => $localeToLanguage[k]);
        }
    },
    mounted() {
        $(this.$el).modal({ blurring: true, })
        $('.selection.dropdown').dropdown()
    },
    methods: {
        localeToLanguage(lang) {
            return $localeToLanguage[lang];
        },
        ...vuex.mapActions(['openDialog', 'updateSetting']),
        show() {
            this.location = remote.app.getPath('userData');
            this.locale = this.$i18n.locale;

            this.selectedTheme = this.theme;
            $(this.$el).modal('show')
            $(this.$refs.fullScreen).checkbox()
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
            this.locale = lang;
        },
        discard() {
            $(this.$el).modal('hide')
        },
        upload(e) {
            this.$i18n.locale = this.locale;
            this.updateSetting({
                resolution: {
                    width: this.reswidth,
                    height: this.resheight,
                    fullscreen: this.resfullscreen,
                },
                location: this.location,
                theme: this.selectedTheme,
                language: this.locale,
            });
            $(this.$el).modal('hide')
        },
    }
}
</script>

<style>
</style>
