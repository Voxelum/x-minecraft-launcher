<template>
    <div class="ui middle aligned selection list">
        <div v-for="(log,index) of logs" :key="index">
            <div class="ui basic label">{{log.time}}</div>
            <div class="ui basic label">{{log.thread}}</div>
            <div class="ui basic label">{{log.level}}</div>
            {{log.message}}
        </div>
    </div>
</template>


<script>
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
            this.logs.push({
                message: log,
                time: tags[0],
                thread: tags[1].substring(0, tags[1].indexOf('/')),
                level: tags[1].substring(tags[1].indexOf('/') + 1)
            })
        }
    }
}
</script>

<style>

</style>
