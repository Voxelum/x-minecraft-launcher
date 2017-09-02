<template>
    <div class="ui card" v-bind:class="{color}">
        <p class="ui top attached label" :data-tooltip="$tc(this.source.type + '.name', 1)" data-inverted="">
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
                {{this.description}}
            </div>
        </div>
        <div class="extra content">
            <i class="user icon"></i> {{this.source.author}}
        </div>
    </div>
</template>
<script>

export default {
    data() {
        return {
            hoverDelete: false,
        }
    },
    computed: {
        version() {
            return this.source.minecraft.version ? this.source.minecraft.version.length != 0 ?
                this.source.minecraft.version : "unknown" : "unknown"
        },
        description() {
            return this.source.description ? this.source.description != 0 ?
                this.source.description : "No description yet." : "No description yet."
        }
    },
    name: 'profile-card',
    props: ['color', 'source', 'id'],
    methods: {
        onclick(e) {
            this.$emit('select', this.id, this.source)
        },
        del(e) {
            this.$emit('delete', { id: this.id, source: this.source })
        },
    },
    mounted() {
    },
}
</script>

<style>

</style>
