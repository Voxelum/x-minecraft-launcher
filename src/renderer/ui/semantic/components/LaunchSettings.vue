<template>
    <div class="ui form">
        <div class="fields">
                <!-- <div class="ui twox wide field">
                    <span>Select</span>
                </div> -->
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
    </div>
</template>

<script>
import vuex from "vuex";

export default {
  mounted() {
    $(this.$refs.path).dropdown({
      onChange: function(value, text, $selectedItem) {
        console.log(value);
        // custom action
      }
    });
  },
  computed: {
    ...vuex.mapGetters(["javas"])
  },
  methods: {
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
        //after user select, the paths should be the paths...
      });
    },
    selectJava() {}
  }
};
</script>

<style>

</style>
