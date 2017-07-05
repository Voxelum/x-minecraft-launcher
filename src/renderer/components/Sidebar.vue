<template>
    <div class="ui segment noselect" style="max-width:300px">
        <div class="ui header">{{this.$store.state.auth.playerName}}</div>
        <div>
            <skin-view></skin-view>
        </div>
        <div>
            <button class="ui button">A</button>
            <button class="ui button">B</button>
            <button class="ui button">C</button>
        </div>
    </div>
</template>
<script>
import SkinView from './SkinViewer'
export default {
    components: {
        SkinView
    }
}
</script>
