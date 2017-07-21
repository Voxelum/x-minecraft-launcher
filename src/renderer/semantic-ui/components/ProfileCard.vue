<template>
    <div class="ui card" v-bind:class="{color}" @click="onclick">
        <div class="image">
            <img :src="this.source.image">
        </div>
        <div class="content">
            <a class="header">{{this.source.name}}</a>
            <div class="meta">
                <span v-if="this.source.type=='server'">{{this.source.ip}}</span>
                <span v-if="this.source.type=='modpack'">{{this.source.author}}</span>
                <span class="date">{{this.source.createdDate}}</span>
            </div>
            <div class="description">
                {{this.source.description}}
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
    name:'profile-card',
    props: ['color', 'source', 'id'],
    methods: {
        onclick(e) {
            this.$emit('select', this.id, this.source)
        }
    },
    mounted() {
    },

}
</script>

<style>

</style>
