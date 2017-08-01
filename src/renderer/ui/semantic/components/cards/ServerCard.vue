<template>
    <div class="ui card" v-bind:class="{color}">
        <p class="ui top attached label" :data-tooltip="$t(this.source.type)" data-inverted="">
            <i class="server icon"></i>
            {{this.source.host}}
            <i class="right floated large delete icon" :class="{red:hoverDelete}" @mouseover="hoverDelete=true" @mouseout="hoverDelete=false" @click="del"></i>
        </p>
        <div class="content" @click="onclick">
            <img :src="this.source.icon" class="right floated ui image">
            <div class="header">
                {{this.source.name}}
            </div>
            <div class="meta">
                <text-component :source="source.status.gameVersion"></text-component>
                <!-- <span class="date">{{this.source.createdDate}}</span> -->
            </div>
            <div class="description">
                <text-component :source="source.status.serverMOTD"></text-component>
            </div>
        </div>
        <div class="extra content">
            <span>
                <i class="user icon"></i> {{this.source.status.onlinePlayers}} / {{this.source.status.capacity}}</span>
            <div class="right floated">
                <i class="signal icon"></i>
                {{this.source.status ? (this.source.status.pingToServer ||-1)+" ms":'Cannot connected'}}
            </div>
        </div>
    </div>
</template>

<script>

import TextComponent from '../TextComponent'
export default {
    components: { TextComponent },
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
