<template>
    <div class="ui basic modal" style="padding:0 20% 0 20%;">
        <div class="ui icon tiny header">
            <i class="setting icon"></i>
            {{$tc('setting.name', 0)}}
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
                <sui-dropdown selection icon="dropdown" :text="selectedTheme" v-model="selectedTheme" :options="themes" />
            </div>
            <div class="field">
                <label>{{$t('setting.language')}}</label>
                <sui-dropdown selection icon="dropdown" :text="selectedLocale" v-model="selectedLocale" :options="locales" />
            </div>
            <sui-divider/>
            <div class="ui inverted right floated button" @click="upload">{{$t('save')}}</div>
            <div class="ui inverted right floated button" @click="discard">{{$t('cancel')}}</div>
        </form>
    </div>
</template>

<script>
import { remote } from 'electron'
import $localeToLanguage from 'static/locale.mapping'

export default {
    data() {
        return {
            selectedTheme: '',
            selectedLocale: '',
            location: '',
        }
    },
    computed: {
        theme() { return this.$store.state.config.theme },
        locale() { return this.$store.state.config.locale },
        themes() {
            return this.$store.state.config.themes.map(t => ({ text: this.$t(t), value: t }))
        },
        locales() {
            return Object.keys(this.$i18n.messages).map(k => ({ text: $localeToLanguage[k], value: k }));
        }
    },
    mounted() {
        $(this.$el).modal({ blurring: true, })
    },
    methods: {
        localeToLanguage(lang) {
            return $localeToLanguage[lang];
        },
        show() {
            this.location = remote.app.getPath('userData');
            this.selectedLocale = this.locale;
            this.selectedTheme = this.theme;

            $(this.$el).modal('show')
            $(this.$refs.fullScreen).checkbox()
        },
        browseFolder() {
            this.$openDialog({ properties: ['openDirectory', 'createDirectory'] })
                .then(files => {
                    this.location = files[0] || this.location;
                })
        },
        cacnelKey(e) {
            e.preventDefault();
        },
        discard() {
            $(this.$el).modal('hide')
        },
        upload(e) {
            if (this.selectedTheme !== this.theme) {
                this.$store.commit('config/theme', this.selectedTheme);
            }
            if (this.selectedLocale !== this.locale) {
                console.log(this.selectedLocale)
                this.$store.commit('config/locale', this.selectedLocale);
            }
            if (this.location !== this.$store.state.root) {
                console.log(this.location)
                this.$store.commit('root', this.location);
            }
            // this.updateSetting({
            //     resolution: {
            //         width: this.reswidth,
            //         height: this.resheight,
            //         fullscreen: this.resfullscreen,
            //     },
            //     location: this.location,
            //     theme: this.selectedTheme,
            //     locale: this.locale,
            // });
            $(this.$el).modal('hide')
        },
    }
}
</script>

<style>
</style>
