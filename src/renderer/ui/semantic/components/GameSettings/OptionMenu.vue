<template>
    <div class="ui  menu">
        <div id="templatesDropdown" class="ui search selection dropdown left item">
            <input type="hidden" name="country">
            <i class="middle aligned dropdown icon"></i>
            <div class="default text">Select Template</div>
            <div class="menu">
                <div class="item" v-for="(key, index) in templates" :key="key">
                    {{index}}
                </div>
            </div>
        </div>
        <a class="link right item">
            Advanced Mode
        </a>
    </div>
</template>
<script>
import vuex from 'vuex'
export default {
    computed: {
        ...vuex.mapGetters('settings', {
            templates: 'options'
        }),
    },
    mounted() {
        $('#templatesDropdown').dropdown();
    },
}
</script>

<style>

</style>
