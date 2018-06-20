<template>
    <div class="ui form">
        <div style="z-index:10" class="ui field">
            <label>Java</label>
            <div class="ui grid">
                <div class="ui fourteen wide column">
                    <sui-dropdown fluid selection icon="dropdown" :options="allJavas" :text="selectedJava" @input="selectJava" />
                </div>
                <div class="ui two wide column">
                    <div class="ui icon fluid button" @click="popDialog">
                        <i class="folder icon"></i>
                    </div>
                </div>
            </div>
        </div>
        <div class="field" style="z-index:0">
            <label>{{$t('launchsetting.jvm')}}</label>
            <labeled-input style="z-index:0" :labels="vmOptions" @dellabel="delVM" @addlabel="addVM"></labeled-input>
        </div>
        <div class="field" style="z-index:0">
            <label>{{$t('launchsetting.mc')}}</label>
            <labeled-input style="z-index:0" :labels="mcOptions" @dellabel="delMC" @addlabel="addMC"></labeled-input>
        </div>
        <div class="field" style="z-index:0">
            <label>Log Window</label>
            <span style="display: inline">Display the log window when the game is launched</span>
            <div ref="checkbox" style="float: right" class="ui slider checkbox" :class="{checked : showLog}">
                <input type="checkbox" @change="toggleLogWindow($event.target.checked)">
                <label></label>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    mounted() {
        if (this.showLog) $(this.$refs.checkbox).checkbox('check')
    },
    computed: {
        allJavas() { return this.$store.getters['java/all'].map(t => ({ text: t, value: t })) },
        id() { return this.$route.params.id },
        selectedJava() { return this.$store.getters[`profiles/${this.id}/java`] },
        vmOptions() { return this.$store.getters[`profiles/${this.id}/vmOptions`] },
        mcOptions() { return this.$store.getters[`profiles/${this.id}/mcOptions`] },
        showLog() { return this.$store.getters[`profiles/${this.id}/logWindow`] },
    },
    methods: {
        toggleLogWindow(log) {
            this.$store.dispatch(`profiles/${this.id}/edit`, { logWindow: log, });
        },
        addVM(arg) {
            this.$store.dispatch(`profiles/${this.id}/edit`,
                { vmOptions: [...this.vmOptions, arg] })
        },
        delVM(arg) {
            this.$store.dispatch(`profiles/${this.id}/edit`,
                { vmOptions: this.vmOptions.filter(a => a !== arg) })
        },
        addMC(arg) {
            this.$store.dispatch(`profiles/${this.id}/edit`,
                { mcOptions: [...this.mcOptions, arg] })
        },
        delMC(arg) {
            this.$store.dispatch(`profiles/${this.id}/edit`,
                { mcOptions: this.mcOptions.filter(a => a !== arg) })
        },
        popDialog(event) {
            this.$openDialog().then(paths => {
                if (paths.length === 0) return;
                this.$store.dispatch(`profiles/${this.id}/edit`, { java: paths[0] })
            });
        },
        selectJava(newPath) {
            this.$store.dispatch(`profiles/${this.id}/edit`, { java: newPath })
        },
    }
};
</script>

<style>
</style>
