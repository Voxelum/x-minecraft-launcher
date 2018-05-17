<template>
    <div style="margin: 10px; background: white; user-select: none; padding: 20px 0;">
        <v-card-text style="padding-left: 40px; padding-right: 40px; padding-bottom: 0px;">
            <v-form>
                <v-select prepend-icon="language" :items="languages" v-model="selectedLanguage" label="Language" flat></v-select>
                <v-select prepend-icon="subtitles" :items="themes" v-model="selectedTheme" label="Theme" flat></v-select>
            </v-form>
        </v-card-text>
        <v-card-actions style="padding-left: 40px; padding-right: 40px; padding-top: 0px">
            <v-flex text-xs-center>
                <v-btn block color="green" round large style="color: white">
                    Save
                </v-btn>
            </v-flex>
        </v-card-actions>
    </div>
</template>

<script>

export default {
    data: () => ({
        themes: ['material', 'semantic'],
        selectedTheme: 'material',
        languages: ['简体中文', 'English'],
        selectedLanguage: 'English',
    }),
    props: {
    },
    mounted() {
        const win = this.$electron.remote.getCurrentWindow();
        win.setSize(400, 400, true);
    },
    methods: {
    },
}
</script>

<style>
.moveable {
  -webkit-app-region: drag;
  user-select: none;
}

.non-moveable {
  -webkit-app-region: no-drag;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
.input-group {
  padding-top: 5px;
}
.password {
  padding-top: 5px;
}
.input-group--text-field label {
  top: 5px;
}
</style>
