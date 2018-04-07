<template>
    <div class="ui card" v-bind:class="{color}">
        <p class="ui top attached label" :data-tooltip="$tc(this.source.type + '.name', 1)" data-inverted="" :data-position="bound? 'bottom center': 'top center'">
            <i class="cubes icon"></i>
            {{this.source.name}}
            <i class="right floated large delete icon" :class="{red:hoverDelete}" @mouseover="hoverDelete=true" @mouseout="hoverDelete=false" @click="del"></i>
        </p>
        <div class="content" @click="onclick">
            <img v-if="this.source.icon" :src="this.source.icon" class="right floated ui image">
            <div class="header">
                {{this.source.name}}
            </div>
            <div class="meta">
                {{this.version}}
            </div>
            <div class="description">
                {{this.source.modpack.description}}
            </div>
        </div>
        <div class="extra content">
            <i class="user icon"></i> {{this.source.modpack.author}}
        </div>
    </div>
</template>
<script>

export default {
    data: () => ({
        hoverDelete: false,
    }),
    computed: {
        version() {
            return this.source.mcversion ? this.source.mcversion.length != 0 ?
                this.source.mcversion : this.$t('unknown') : this.$t('unknown')
        },
        description() {
            return this.source.description ? this.source.description != 0 ?
                this.source.description : this.$t('nodescription') : this.$t('nodescription')
        }
    },
    props: ['color', 'source', 'id', 'bound'],
    methods: {
        onclick(e) {
            this.$emit('select', this.id, this.source)
        },
        del(e) {
            this.$emit('delete', this.id, this.source)
            e.preventDefault()
        },
    },
    mounted() {
    },
}
</script>

<style>

</style>
