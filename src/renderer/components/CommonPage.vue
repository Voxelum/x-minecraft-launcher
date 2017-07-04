<template>
    <div class="ui noselect">
        <div></div>
        <div>
            <canvas></canvas>
        </div>
        <div>
            <button>A</button>
            <button>B</button>
            <button>C</button>
        </div>
    </div>
</template>

<script>
export default {
    name: 'common-page',
    mounted(e) {
        console.log('common ' + (this.$store != undefined))
    }
}
</script>
