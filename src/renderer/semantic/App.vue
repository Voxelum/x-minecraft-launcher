<template>
    <div id="app">
        <router-view @drop="ondrop"></router-view>
    </div>
</template>

<script>
export default {
    mounted() {
        let dragTimer;
        const store = this.$store
        $(document).on('dragover', function (e) {
            e.preventDefault()
            const dt = e.originalEvent.dataTransfer;
            if (dt.types && (dt.types.indexOf ? dt.types.indexOf('Files') != -1
                : dt.types.contains('Files'))) {
                if (!store.state.dragover) store.localCommit('dragover', true);
                window.clearTimeout(dragTimer);
            }
        });
        $(document).on('dragleave', function (e) {
            dragTimer = window.setTimeout(function () {
                store.localCommit('dragover', false);
            }, 25);
        });
    },
    methods: {
        ondrop(event) {
            event.preventDefault()
            this.$store.localCommit('dragover', false)
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
