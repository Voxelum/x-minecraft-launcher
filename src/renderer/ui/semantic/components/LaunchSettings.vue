<template>
    <div class="ui form">
        <div class="field">
            <label>JVM Argument</label>
            <input type="text" name="first-name" >
        </div>
        <div class="field">
            <label>Minecraft Argument</label>
            <input type="text" name="last-name" >
    </div>
            
        <div class="fields">
            <div class="ui inline field">
                <label>Java</label>
                <div ref="path" class="ui selection dropdown" style="min-width:400px">
                    <input type="hidden" name="java path">
                        <i class="dropdown icon"></i>
                    <div class="default text">Java path</div>
                    <div class="menu">
                        <li class="item" v-for="value in javas" :key="value">
                            {{value}}
                        </li>
                    </div>
                </div>
                <div class="ui icon button" @click="popDialog">
                    <i class="add icon"></i>
                </div>
            </div>
        </div>
        <button class="ui button" type="submit" @click="save">Save</button>
        <div class="ui cookie nag">
            <span class="title">
                Successfully saved!
            </span>
            <i class="close icon"></i>
        </div>
    </div>
        
</template>

<script>
import vuex from "vuex";

export default {
<<<<<<< HEAD
    // data: () => ({
    //     vmOptions: '',
    //     mcOptions: '',
    //     minMemory: 0,
    //     maxMemory: 0,
    // }),
    methods: {
        ...vuex.mapActions(['addJavas', 'openDialog']),
        save() {
            const id = this.$store.getters['profiles/selectedKey']
            // this.$store.commit('putAll', {
            //     vmOptions: vmOptions,
            //     mcOptions: 
            // })
        },
        popDialog(event){
            // @Assign to phoebe, luca
            // should popup dialog here then collect user selected java path
            // suppose you get the java path store here: 
            // const javapath = ...;
            // you should store java path into vuex's store by: 
            // this.addJavas(javapath);
            this.openDialog({}).then((paths)=>{
=======
      mounted() {
        $(this.$refs.path).dropdown({
        onChange: function(value, text, $selectedItem) {
            console.log(value);
            // custom action
        }
        });
    },
    computed:{
        ...vuex.mapGetters('profiles', {
            id: "selectedKey",
        }),
         ...vuex.mapGetters(["javas"]),
        vmOptions(){
            return this.$store.getters[`profiles/${id}/vmOptions`]
        },
        mcOptions(){
            return this.$store.getters[`profiles/${id}/mcOptions`] 
        }
    },
    methods: {
        save(){
           $('.cookie.nag').nag('show'); 
        },
        ...vuex.mapActions(["addJavas", "openDialog"]),
        popDialog(event) {
        // @Assign to phoebe, luca
        // should popup dialog here then collect user selected java path
        // suppose you get the java path store here:
        // const javapath = ...;
        // you should store java path into vuex's store by:
        // this.addJavas(javapath);
            this.openDialog({}).then(paths => {
                this.addJavas(paths[0]);
                console.log(paths[0]);
>>>>>>> 9adde1f8d51a3875133b1d251677bfd1ae19efba
                //after user select, the paths should be the paths...
            });
        },

        selectJava(){

        },
    }

};
</script>

<style>

</style>
