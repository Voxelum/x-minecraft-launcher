<template>
    <div class="item">
        <div class="content">
            <!-- <h3 class="header">
                        {{meta.name}}
                    </h3> -->
            <!-- <div class="meta">
                    <span v-if="meta.authorList&&meta.authorList.length!=0">Authors:</span>
                    <span v-for="author in meta.authorList" :key="author">
                        {{author}}
                    </span>
                </div> -->
            <a class="ui right floated green basic tiny button">Enabled</a>
            <div class="content">
                <a class="ui label">{{meta.name}}</a>
                <a class="ui basic samll label">Minecraft: &nbsp{{meta.mcversion}}</a>
                <a id="versionDropdown" class="ui basic label above upward dropdown versionDropdown">
                    Version: &nbsp
                    <div class="text">{{meta.version}}</div>
                    <div class="menu">
                        <a class="item ui basic small label" v-for="m of others" :key="m">
                            {{m.version}}
                        </a>
                    </div>
                </a>
            </div>
            <!-- <div class="description">
                        {{meta.description}}
                    </div> -->

            <!-- <div class="extra">
                    <a class="ui basic samll label">Minecraft: &nbsp{{meta.mcversion}}</a>
                    <a id="versionDropdown" class="ui basic label above upward dropdown versionDropdown">
                        Version: &nbsp
                        <div class="text">{{meta.version}}</div>
                        <div class="menu">
                            <a class="item ui basic small label" v-for="m of others" :key="m">
                                {{m.version}}
                            </a>
                        </div>
                    </a>
                </div> -->
        </div>

    </div>
</template>

<script>
export default {
    data() {
        return {
            selected: '',
        }
    },
    props: ['value'],
    computed: {
        meta() { return this.value[0] ? this.value[0] : {}; },
        others() { return this.value }
    },
    mounted() {
        $('.versionDropdown').dropdown({
            direction: "upward",
        });
        // $(this.$el).dimmer({ on: 'hover' })
    }
}
</script>

<style>

</style>
