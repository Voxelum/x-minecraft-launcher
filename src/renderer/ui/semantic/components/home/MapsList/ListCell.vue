<template>
    <div class="image item">
        <div class="ui tiny rounded image">
            <img :src="map.icon">
        </div>
        <div class="content">
            <h3 class="header">
                {{map.displayName}}
            </h3>
            <div class="meta">
                {{$t(gameType)}} Mode
            </div>
            <div class="extra">
                <div class="ui label"> {{$t(difficulty)}}</div>
                <div class="ui label" v-if="map.isHardCore">{{$t('hardcore')}}</div>
                <div class="ui label" v-if="map.enabledCheat">{{$t('cheat')}}</div>
                <div class="ui right floated basic red button">
                    {{$t('remove')}}
                </div>
            </div>
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
