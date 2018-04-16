<template>
    <div class="ui moveable padded segment" :class="{inverted:inverted}" style="height:100%;overflow:hidden;border-radius: 0px">
        <div class="ui middle aligned selection list" :class="{inverted:inverted}" style="height:100%;overflow:auto">
            <div v-for="(log,index) of logs" :key="index" class="inverted item non-moveable">
                <div class="ui label" :class="{black:inverted,inverted:inverted}">{{log.time}}</div>
                <div class="ui label" :class="{black:inverted,inverted:inverted}">{{log.thread}}</div>
                <div class="ui label" :class="{black:inverted,inverted:inverted}">{{log.level}}</div>
                &nbsp{{log.message}}
            </div>
        </div>
    </div>
</template>


<script>
import 'static/semantic/semantic.min.css'
import 'static/semantic/semantic.min.js'

import { decode } from 'iconv-lite'
import { ipcRenderer } from 'electron'

function message(s, tags) {
    let start = 0
    while (start !== -1) {
        start = s.indexOf('[')
        if (start === -1) break;
        let end = s.indexOf(']') + 1
        let tag = s.substring(start + 1, end - 1);
        tags.push(tag);
        s = s.substring(end);
    }
    return s.replace(':', '').trim();
}

export default {
    data() {
        return {
            inverted: true,
            logs: [],
        }
    },
    mounted() {
        const self = this;
        ipcRenderer.on('minecraft-stdout', (event, s) => {
            self.onLog(s);
        })
    },
    methods: {
        onLog(log) {
            let tags = []
            log = message(log, tags);
            log = decode(new Buffer(log), 'gbk')
            this.logs.push({
                message: log,
                time: tags[0] || '',
                thread: tags[1] ? tags[1].substring(0, tags[1].indexOf('/')) : '',
                level: tags[1] ? tags[1].substring(tags[1].indexOf('/') + 1) : ''
            })
        }
    }
}
</script>

<style>
body {
  overflow-y: hidden;
}

.moveable {
  -webkit-app-region: drag;
}

.non-moveable {
  -webkit-app-region: no-drag;
}
</style>
