<template>
    <div class="ui card" v-bind:class="{color}" @click="emit">
        <div class="image">
            <img :src="this.source.state.image">
        </div>
        <div class="content">
            <a class="header">{{this.source.state.name}}</a>
            <div class="meta">
                <span v-if="this.source.state.type=='server'">{{this.source.state.ip}}</span>
                <span v-if="this.source.state.type=='modpack'">{{this.source.state.author}}</span>
                <span class="date">{{this.source.state.createdDate}}</span>
            </div>
            <div class="description">
                {{this.source.state.description}}
            </div>
        </div>
        <div class="extra content">
            <span v-if="this.source.state.type=='server'">
                <i class="wifi icon"></i>
                {{this.source.state.ping ? this.source.state.ping+" ms":'Cannot connected'}}
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
        console.log(this.source.state)
    }
}
</script>

<style>

</style>
