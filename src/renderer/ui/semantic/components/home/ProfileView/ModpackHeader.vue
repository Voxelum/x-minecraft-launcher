<template>
    <div class="row" style="max-height:20vh; min-height:20vh;">
        <div class="eight wide column">
            <div class="ui sizer" style="font-size: 23px;">
                <h1 class="ui header">
                    <div class="content">
                        {{name}}
                        <h2 class="ui sub header">
                            {{$t('author')}}: {{author}}
                        </h2>
                        <h2 class="ui sub header">
                            {{$tc('version.name', 0)}}: {{version}}
                        </h2>
                        <h2 class="ui sub header" v-if="forgeVersion">
                            {{$tc('forge.name', 0)}}: {{forgeVersion}}
                        </h2>
                        <h2 class="ui sub header" v-if="liteloaderVersion">
                            {{$tc('liteloader.name', 0)}}: {{liteloaderVersion}}
                        </h2>
                    </div>
                </h1>
            </div>
        </div>
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="tag icon"></i>
                {{$t('description')}}
            </h5>
            <div>
                {{description}}
            </div>
        </div>
    </div>
</template>

<script>
export default {
    computed: {
        description() {
            return this.$store.getters[`profiles/${this.$route.params.id}/modpack/description`]
        },
        author() {
            return this.$store.getters[`profiles/${this.$route.params.id}/modpack/author`]
        },
        version() {
            return this.$store.getters[`profiles/${this.$route.params.id}/mcversion`]
                || 'Unselected'
        },
        name() {
            return this.$store.getters[`profiles/${this.$route.params.id}/name`]
                || 'Untitled'
        },
        forgeVersion() {
            return this.$store.getters[`profiles/${this.$route.params.id}/forge/version`]
        },
        liteloaderVersion() {
            return this.$store.getters[`profiles/${this.$route.params.id}/liteloader/version`]
        },
    },
}
</script>

<style>

</style>
