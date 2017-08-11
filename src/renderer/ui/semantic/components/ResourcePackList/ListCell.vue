<template>
    <div class="dimmable item" style="border-radius: 5px;">
        <div class="ui inverted dimmer">
            <div class="content">
                <div class="center">
                    <div v-if="type==='add'" class="ui green basic button" @click="$emit('change',entry.value.meta.packName)">Add</div>
                    <div v-if="type==='remove'" class="ui red basic button" @click="$emit('change',entry.value.meta.packName)">Remove</div>
                </div>
            </div>
        </div>
        <img class="ui tiny rounded image" :src="entry.value.meta.icon">
        <div class="content">
            <h3 class="header">{{entry.value.meta.packName}}</h3>
            <div class="description">
                <text-component :source="entry.value.meta.description"></text-component>
            </div>
        </div>
    </div>
</template>

<script>
import TextComponent from '../TextComponent'

export default {
    components: { TextComponent },
    mounted() {
        $(this.$el).dimmer({ on: 'hover' })
    },
    props: ['entry', 'type']
}
</script>

<style>

</style>
