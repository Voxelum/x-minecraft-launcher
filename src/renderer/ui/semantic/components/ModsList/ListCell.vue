<template>
    <div class="dimmable item">
        <!-- <div class="ui inverted dimmer">
                                <div class="content">
                                    <div class="center">
                                        <div class="ui icon buttons">
                                            <a class="ui right floated green basic button">Enabled</a>
                                        </div>
                                    </div>
                                </div>
                            </div> -->
        <div class="content">
            <h3 class="header">
                {{meta.name}}
            </h3>
            <div class="meta">
                <span v-if="meta.authorList&&meta.authorList.length!=0">Authors:</span>
                <span v-for="author in meta.authorList" :key="author">
                    {{author}}
                </span>
            </div>
            <div class="description">
                {{meta.description}}
            </div>
            <div class="extra">
                <a class="ui basic small label">Version: &nbsp {{meta.version}}</a> 
                <a class="ui basic samll label">Minecraft: &nbsp{{meta.mcversion}}</a>
                <!-- <div class="ui icon buttons"> -->
                <a class="ui right floated green basic tiny button">Enabled</a>
                <!-- </div> -->
                <!-- <span v-if="meta.credits">
                                        Credit: {{meta.credits}}
                                    </span> -->
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: ['value'],
    computed: {
        meta() { return this.value.meta; }
    },
    mounted() {
        // $(this.$el).dimmer({ on: 'hover' })
    }
}
</script>

<style>

</style>
