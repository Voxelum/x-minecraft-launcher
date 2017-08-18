<template>
    <div class="dimmable item" style="border-radius: 5px;">
        <!-- <div class="ui inverted dimmer">
                        <div class="content">
                            <div class="center">
                                <div class="ui icon buttons">
                                    <div class="ui basic black button" v-if="type === 'remove'" @click="$emit('moveup', val.name)">
                                        <i class="arrow up icon"></i>
                                    </div>
                                    <div v-if="type==='add'" class="ui red basic button" @click="$emit('delete',val.meta.hash)">{{$t('!delete')}}</div>
                                    <div v-if="type==='add'" class="ui green basic button" @click="$emit('change',val.name)">&nbsp&nbsp&nbsp{{$t('add')}}&nbsp&nbsp&nbsp</div>
                                    <div v-if="type==='remove'" class="ui red basic button" @click="$emit('change',val.name)">{{$t('remove')}}</div>
                                    <div class="ui basic black button" v-if="type === 'remove'" @click="$emit('movedown', val.name)">
                                        <i class="arrow down icon"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div> -->
        <!-- <img class="ui avatar image"> -->
        <div class="right floated content">
      <div class="ui button">Add</div>
    </div>
        <div class="content">
            <h3 class="header">
                {{meta.name}} : 
                {{meta.version}}
                <div class="ui label" v-for="author in meta.authorList" :key="author">
                    {{author}}
                </div>
            </h3>
            <div class="description" style="">
                <!-- {{meta.version}} -->
                {{meta.description}}
                <!-- {{value}} -->
                <!-- <text-component :source="value.meta.description"></text-component> -->
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: ['value'],
    computed: {
        meta() { return this.value.meta; }
    },
    mounted(){
    }
}
</script>

<style>

</style>
