<template>
    <div class="ui card" v-bind:class="{color}" @click="emit">
        <div class="image">
            <img :src="image">
        </div>
        <div class="content">
            <a class="header">{{name}}</a>
            <div class="meta">
                <span class="date">{{createdDate}}</span>
            </div>
            <div class="description">
                {{description}}
            </div>
        </div>
        <div class="extra content">
            <a>
                <i class="user icon"></i>
                {{author}}
            </a>
        </div>
    </div>
</template>

<script>
export default {
    props: ['color', 'image', 'name', 'createdDate', 'description', 'author'],
    methods: {
        emit() { this.$emit('select') }
    }
}
</script>

<style>

</style>
