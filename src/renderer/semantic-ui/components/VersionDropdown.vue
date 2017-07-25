<template>
    <div id="vdropdown" class="ui fluid search selection dropdown labeled button">
        <div class="default text">Select Version</div>
        <i class="dropdown icon"></i>
        <div class="menu">
            <div class="item" v-for="meta in metas" :key="meta" :data-value="meta.id">
                <a class="ui label" :class="{red: meta.type=='snapshot'}">{{meta.type}}</a>
                {{meta.id}}
            </div>
        </div>
    </div>
</template>

<script>
import { mapState } from 'vuex'
export default {
    mounted() {
        $('#vdropdown').dropdown()
    },
    computed: {
        ...mapState('versions', ['minecraft']),
        metas() {
            return this.minecraft.versions
        }
    }
}
</script>

<style>

</style>
