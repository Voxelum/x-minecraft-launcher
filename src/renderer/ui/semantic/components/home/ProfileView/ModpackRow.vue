<template>
    <div class="row" style="max-height:150px;min-height:150px;">
        <div class="eight wide column">
            <div class="ui sizer" style="font-size: 23px;">
                <h1 class="ui header">
                    <div class="content">
                        {{name}}
                        <h2 class="ui sub header">
                            {{$t('author')}}: {{author}}
                        </h2>
                        <h2 ref="versionPopup" class="ui sub header">
                            {{$tc('version.name', 0)}}: {{mcversion}}
                            <i class="dropdown icon"></i>
                        </h2>
                        <version-table-view :id="id"></version-table-view>
                    </div>
                </h1>
            </div>
        </div>
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="tag icon"></i>
                {{$t('description')}}
            </h5>
            <textarea :value="description" @blur="modify" style="width:100%;border:0;outline:none;overflow: hidden;resize:none;background-color:transparent;">
            </textarea>
        </div>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'
import VersionTableView from '../VersionTableView'

export default {
    components: {
        VersionTableView
    },
    computed: {
        id() { return this.$route.params.id },

        author() { return this.$store.getters[`profiles/${this.id}/author`] },
        mcversion() { return this.$store.getters[`profiles/${this.id}/mcversion`] },
        name() { return this.$store.getters[`profiles/${this.id}/name`] },
        description() { return this.$store.getters[`profiles/${this.id}/description`] },
    },
    methods: {
        modify(event) {
            this.$store.dispatch(`profiles/${this.id}/edit`, { description: event.target.value })
        },
        refresh() {
            this.$store.dispatch(`profiles/${this.id}/refresh`)
            this.$store.dispatch('versions/refresh')
        },
    },
    mounted() {
        $(this.$refs.versionPopup).popup({
            position: 'bottom left',
            hoverable: true,
            delay: {
                show: 300,
                hide: 800
            }
        });
    },
}
</script>

<style>

</style>
