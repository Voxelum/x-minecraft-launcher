<template>
    <div>
        <side-bar></side-bar>
        <button class="ui button">Launch</button>
    </div>
</template>

<script>
import SideBar from './SideBar'
export default {
    name: 'common-page',
    mounted(e) {
    },
    components: {
        SideBar
    }
}
</script>
