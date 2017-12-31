<template>
    <div @drop="ondrop">
        <router-view></router-view>
    </div>
</template>

<script>
import vuex from 'vuex'

export default {
    computed: {
        theme() {
            return this.$store.getters['appearance/theme']
        }
    },
    watch: {
        theme() {
            this.$router.replace(`/${this.theme}`)
        }
    },
    beforeMount() {
        const route = localStorage.getItem('route');
        console.log(`Initialize to route ${route}`)
        if (route && route !== '/' &&
            this.$store.getters['appearance/themes'].indexOf(route.split('/')[1]) !== -1) {
            this.$router.replace(route)
        } else {
            this.$router.replace(`/${this.theme}`)
        }
    },
    mounted() {
        let dragTimer;
        const store = this.$store
        $(document).on('dragover', function (e) {
            e.preventDefault()
            const dt = e.originalEvent.dataTransfer;
            if (dt.types && (dt.types.indexOf ? dt.types.indexOf('Files') != -1
                : dt.types.contains('Files'))) {
                if (!store.state.dragover) store.commit('dragover', true);
                window.clearTimeout(dragTimer);
            }
        });
        $(document).on('dragleave', function (e) {
            dragTimer = window.setTimeout(function () {
                store.commit('dragover', false);
            }, 25);
        });
    },
    methods: {
        ondrop(event) {
            event.preventDefault()
            this.$store.commit('dragover', false)
            // return false;
        },
    },
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
