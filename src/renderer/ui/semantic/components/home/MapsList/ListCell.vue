<template>
    <div class="image item" @contextmenu="openContextMenu">
        <div class="ui tiny rounded image">
            <img v-if="!imageError" :src="icon" @error="imageError = true">
            <i v-else class="huge bordered fitted map icon" style="font-size:3.5em"></i>
        </div>
        <div class="content" ref="contextMenu">
            <h3 class="header">
                {{map.displayName}}
            </h3>
            <div class="meta">
                {{$t(gameType)}}
            </div>
            <div class="extra">
                <a class="ui label"> {{$t(difficulty)}}</a>
                <a class="ui label" v-if="map.isHardCore">{{$t('hardcore')}}</a>
                <a class="ui label" v-if="map.enabledCheat">{{$t('cheat')}}</a>
                <a class="ui right floated basic red button" @click="$emit('remove', map)">
                    {{$t('remove')}}
                </a>
                <a class="ui right floated basic button" @click="$emit('export', map)">
                    {{$t('map.export')}}
                </a>
            </div>
        </div>
    </div>
</template>

<script>
import defaultIcon from 'static/unknown_server.png'
import { ipcRenderer } from 'electron'

export default {
    data: () => ({
        imageError: false,
    }),
    props: ['map'],
    computed: {
        icon() {
            return this.map.icon || defaultIcon;
        },
        difficulty() {
            switch (this.map.difficulty) {
                case 0: return 'difficulty.peaseful'
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
    mounted() {
    },
    methods: {
        openContextMenu(event) {
            const self = this; 
            ipcRenderer.emit('contextMenu', [
                {
                    name: 'Import',
                    onclick() {
                        
                    },
                },
                {
                    name: 'Export',
                    onclick() {
                        self.$emit('export');
                    },
                },
            ]);
        },
    }
}
</script>
