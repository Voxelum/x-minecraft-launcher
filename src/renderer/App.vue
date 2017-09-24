<template>
    <div @drop="ondrop">
        <router-view></router-view>
    </div>
</template>

<script>

import { mapState } from 'vuex'
export default {
    watch: {
        theme() {
            this.$router.push(this.theme)
        }
    },
    computed: {
        ...mapState(['theme'])
    },
    beforeMount() {
        this.$router.push(this.theme)
    },
    mounted() {
        let dragTimer;
        const store = this.$store
        $(document).on('dragover', function(e) {
            e.preventDefault()
            var dt = e.originalEvent.dataTransfer;
            if (dt.types && (dt.types.indexOf ? dt.types.indexOf('Files') != -1
                : dt.types.contains('Files'))) {
                if (!store.state.dragover) store.commit('dragover', true);
                window.clearTimeout(dragTimer);
            }
        });
        $(document).on('dragleave', function(e) {
            dragTimer = window.setTimeout(function() {
                store.commit('drag/dragover', false);
            }, 25);
        });
    },
    methods: {
        ondrop(event) {
            event.preventDefault()
            this.$store.commit('drag/dragover', false)
            return false;
        },
    }
}
</script>

<style>
.noselect {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}
</style>
