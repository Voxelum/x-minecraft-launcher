<template>
    <div class="ui card" v-bind:class="{color}">
        <p class="ui top attached label" :data-tooltip="$t(this.source.type)" data-inverted="">
            <span v-if="this.source.type=='server'">
                <i class="server icon"></i>
            </span>
            <span v-else>
                <i class="cubes icon"></i>
            </span>
            {{this.source.name}}
            <i class="right floated large delete icon" :class="{red:hoverDelete}" @mouseover="hoverDelete=true" @mouseout="hoverDelete=false" @click="del"></i>
        </p>
        <div class="image">
            <img :src="this.source.image">
        </div>
        <div class="content" @click="onclick">
            <div class="meta">
                <span class="ui tiny label">
                    {{this.source.version?this.source.version.length!=0?"unknown":this.source.version:"unknown"}}
                </span>
                <span v-if="this.source.type=='server'">{{this.source.ip}}</span>
                <span v-if="this.source.type=='modpack'">{{this.source.author}}</span>
                <span class="date">{{this.source.createdDate}}</span>
            </div>
            <div class="description">
                {{this.source.description?this.source.description!=0?this.source.description:"No description yet.":"No description yet."}}
            </div>
        </div>
        <div class="extra content">
            <span v-if="this.source.type=='server'">
                <i class="wifi icon"></i>
                {{this.source.ping ? this.source.ping+" ms":'Cannot connected'}}
            </span>
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
