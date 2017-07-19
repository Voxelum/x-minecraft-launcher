<template>
    <div class="ui card" v-bind:class="{color}" @click="emit">
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
    data() {
        return {
        }
    },
    props: ['color', 'source', 'image', 'name', 'createdDate', 'description', 'from', 'type', 'ping', 'ip', 'author'],
    methods: {
        emit() { this.$emit('select') },
    },
    mounted() {
        console.log(this.source)
    }
}
</script>

<style>

</style>
