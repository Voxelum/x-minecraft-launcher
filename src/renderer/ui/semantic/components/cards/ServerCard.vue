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
                {{this.source.version?this.source.version.length!=0?"unknown":this.source.version:"unknown"}}
                <span class="date">{{this.source.createdDate}}</span>
            </div>
            <div class="description">
            </div>
        </div>
        <div class="extra content">
            <div>
                <i class="user icon"></i> {{this.source.status.onlinePlayers}} / {{this.source.status.capacity}}
            </div>
            <div class="right floated">
                <i class="wifi icon"></i>
                {{this.source.status ? (this.source.status.pingToServer ||-1)+" ms":'Cannot connected'}}
            </div>
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
