<template>
    <div class="dimmable center aligned item" style="border-radius: 5px;">
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
        <img class="ui rounded image" :src="map.icon">
        &nbsp
        <div class="content">
            <h3 class="header">
                {{map.displayName}}
            </h3>
            <div class="ui label"> {{$t(gameType)}}</div>
            <div class="ui label"> {{$t(difficulty)}}</div>
            <div class="ui label" v-if="map.isHardCore">hardcore</div>
            <div class="ui label" v-if="map.enabledCheat">cheat</div>
        </div>
        <div class="right floated middle aligned content">
            <div class="ui button">Add</div>
        </div>
    </div>
</template>

<script>
export default {
    props: ['id', 'map'],
    computed: {
        difficulty() {
            switch (this.map.difficulty) {
                case 0: return 'difficulty.peasefule'
                case 1: return 'difficulty.easy'
                case 2: return 'difficulty.normal'
                case 3: return 'difficulty.hard'
            }
            return 'difficulty.non'
        },
        gameType() {
            switch (this.map.gameType) {
                case 0: return 'gametype.survival'
                case 1: return 'gametype.creative'
                case 2: return 'gametype.adventure'
                case 3: return 'gametype.spectator'
                default:
                case -1: return "gametype.non"
            }
            return "gametype.non"
        }
    },
}
</script>
