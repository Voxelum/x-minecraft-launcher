<template>
    <div class="ui card" v-bind:class="{color}" @click="emit">
        <div class="image">
            <img :src="image">
        </div>
        <div class="content">
            <a class="header">{{name}}</a>
            <div class="meta">
                <span v-if="type=='server'">{{ip}}</span>
                <span v-if="type=='modpack'">{{author}}</span>
                <span class="date">{{createdDate}}</span>
            </div>
            <div class="description">
                {{description}}
            </div>
        </div>
        <div class="extra content">
            <span v-if="type=='server'">
                <i class="wifi icon"></i>
                {{ping ? ping+" ms":'Cannot connected'}}
            </span>
        </div>
    </div>
</template>

<script>
export default {
    props: ['color', 'image', 'name', 'createdDate', 'description', 'from', 'type', 'ping', 'ip', 'author'],
    methods: {
        emit() { this.$emit('select') }
    }
}
</script>

<style>

</style>
