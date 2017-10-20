<template>
    <div>
        <div class="ui segment">
            Try to display selected java, maybe here? 
        </div>
        <div class="ui segment">
            Here should display the list of existing javas
        </div>
        <div class="ui icon button" @click="popDialog">
            After this button click, it should popup a dialog
            <i class="add icon"></i>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'

export default {
    methods: {
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
