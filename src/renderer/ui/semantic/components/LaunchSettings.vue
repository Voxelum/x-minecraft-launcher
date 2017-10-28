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
        <button class="ui button" type="submit" @click="save">Save</button>
    </div>
</template>

<script>
import vuex from 'vuex'

export default {
    computed:{
        ...vuex.mapGetters('profiles', {
            id: "selectedKey",
        }),
        vmOptions(){
            return this.$store.getters[`profiles/${id}/vmOptions`]
        },
        mcOptions(){
            return this.$store.getters[`profiles/${id}/mcOptions`] 
        }
    },
    methods: {
        save(){
            
        },
        ...vuex.mapActions(['addJavas', 'openDialog']),
        popDialog(event){
            // @Assign to phoebe, luca
            // should popup dialog here then collect user selected java path
            // suppose you get the java path store here: 
            // const javapath = ...;
            // you should store java path into vuex's store by: 
            // this.addJavas(javapath);
            this.openDialog({}).then((paths)=>{
                //after user select, the paths should be the paths...
            })
        },
        selectJava(){

        },
    },
}
</script>

<style>

</style>
