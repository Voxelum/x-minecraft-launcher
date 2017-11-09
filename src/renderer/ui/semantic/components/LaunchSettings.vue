<template>
    <div>
        <div class="ui form">
            <div class="field">
                <label>JVM Argument</label>
                <labeled-input :labels="vmOptions" @dellabel="delVM" @addlabel="addVM"></labeled-input>
            </div>
            <div class="field">
                <label>Minecraft Argument</label @dellabel="delMC" @addlabel="addMC">
                <labeled-input :labels="mcOptions"></labeled-input>
            </div>
            <div class="fields">
                <div class="ui field">
                    <label>Java</label>
                    <div class="ui grid">
                        <div class="ui thirteen wide column">
                            <div ref="path" class="ui selection dropdown" style="min-width:370px">
                                <input type="hidden" name="java path">
                                <i class="dropdown icon"></i>
                                <div class="default text">{{javaPath}}</div>
                                <div class="menu">
                                    <li class="item" v-for="value in javas" :key="value">
                                        {{value}}
                                    </li>
                                </div>
                            </div>
                        </div>
                        <div class="ui column">
                            <div class="ui icon button" @click="popDialog">
                                <i class="add icon"></i>
                            </div>
                        </div>
                        <div class="ui column">
                            <div class="ui icon button" @click="popDialog">
                                <i class="remove icon"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import vuex from "vuex";
import LabeledInput from './LabeledInput'

export default {
    components: { LabeledInput },
    data: () => ({
        state: 'nochange',
        javaPath: '',
    }),
    mounted() {
        $(this.$refs.path).dropdown({
            onChange: function (value, text, $selectedItem) {
                console.log(value);
                // custom action
            }
        });
    },
    computed: {
        ...vuex.mapGetters('profiles', {
            id: "selectedKey",
        }),
        ...vuex.mapGetters(["javas"]),
        vmOptions() {
            return this.$store.getters[`profiles/${this.id}/vmOptions`]
        },
        mcOptions() {
            return this.$store.getters[`profiles/${this.id}/mcOptions`]
        }
    },
    methods: {
        ...vuex.mapActions(["addJavas", "openDialog"]),
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
            this.openDialog({}).then(paths => {
                this.addJavas(paths[0]);
            });
        },

        selectJava() {

        },
    }

};
</script>

<style>

</style>
