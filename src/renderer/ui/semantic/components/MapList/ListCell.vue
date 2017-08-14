<template>
    <div class="dimmable item" style="border-radius: 5px;">
        <div class="ui inverted dimmer">
            <div class="content">
                <div class="center">
                    <div class="ui icon buttons">
                        <!-- <div class="ui basic black button" v-if="type === 'remove'" @click="$emit('moveup', entry.value.meta.packName)">
                                        <i class="arrow up icon"></i>
                                    </div>
                                    <div v-if="type==='add'" class="ui red basic button" @click="$emit('delete',entry.key)">{{$t('!delete')}}</div>
                                    <div v-if="type==='add'" class="ui green basic button" @click="$emit('change',entry.value.meta.packName)">&nbsp&nbsp&nbsp{{$t('add')}}&nbsp&nbsp&nbsp</div>
                                    <div v-if="type==='remove'" class="ui red basic button" @click="$emit('change',entry.value.meta.packName)">{{$t('remove')}}</div>
                                    <div class="ui basic black button" v-if="type === 'remove'" @click="$emit('movedown', entry.value.meta.packName)">
                                        <i class="arrow down icon"></i>
                                    </div> -->
                    </div>
                </div>
            </div>
        </div>
        <img class="ui avatar image" :src="map.icon">
        <div class="content">
            <h3 class="header">
                {{map.displayName}}
            </h3>
            <div class="description" style="max-width:220px">
            </div>
            <div class="meta">
                Size: {{map.sizeOnDisk}}
                <div class="ui label" v-if="map.isHardCore">hardcore</div>
                <div class="ui label" v-if="map.enabledCheat">cheat</div>
                <div class="ui label">{{map.gameType}}: {{map.difficulty}}</div>
            </div>
        </div>
    </div>
</template>

<script>
export default {

    props: ['id', 'name', 'map']
}
</script>
