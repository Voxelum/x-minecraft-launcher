<template>
    <div class="dimmable item" style="border-radius: 5px;">
        <div class="ui inverted dimmer">
            <div class="content">
                <div class="center">
                    <div class="ui icon buttons">
                        <div class="ui basic black button" v-if="type === 'remove'" @click="$emit('moveup', val.name)">
                            <i class="arrow up icon"></i>
                        </div>
                        <transition v-if="type==='add'" mode="out-in" @blur="deleting = false">
                            <div v-if="!deleting" class="ui red basic button" @click="deleting = true" @blur="deleting = false">X</div>
                            <div v-if="deleting" class="ui red basic button" @click="$emit('delete', val.hash)" @blur="deleting = false">{{$t('!delete')}}</div>
                        </transition>
                        <div v-if="type==='add'" class="ui green basic button" @click="$emit('change',val.name)">&nbsp&nbsp&nbsp{{$t('add')}}&nbsp&nbsp&nbsp</div>
                        <div v-if="type==='remove'" class="ui red basic button" @click="$emit('change',val.name)">{{$t('remove')}}</div>
                        <div class="ui basic black button" v-if="type === 'remove'" @click="$emit('movedown', val.name)">
                            <i class="arrow down icon"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <img class="ui avatar image" :src="val.meta.icon">
        <div class="content">
            <h3 class="header">
                {{val.name}}
            </h3>
            <div class="description" style="max-width:220px">
                <text-component :source="val.meta.description"></text-component>
            </div>
        </div>
    </div>
</template>

<script>
import TextComponent from '../TextComponent'

export default {
    data() {
        return {
            deleting: false,
        }
    },
    components: { TextComponent },
    mounted() {
        $(this.$el).dimmer({ on: 'hover' })
        console.log(this.val)
    },
    props: ['val', 'type'],
    methods: {
    }
}
</script>

<style>

</style>
