<template>
    <div>
        <div v-if="selecting">
            <div v-if="selectedProfile.type==='server'"></div>
            <div v-else>
                <div class="ui fluid inverted button non-moveable" @click="launch">Launch</div>
            </div>
        </div>
        <div v-else>
            <div class="ui icon right floated circlar inverted button non-moveable" @click="showModal('profile')">
                <i class="plus icon"></i>
                {{$t('profile.add.modpack')}}
            </div>
            <div class="ui icon right floated circlar inverted button non-moveable" @click="showModal('server')">
                <i class="plus icon"></i>
                {{$t('profile.add.server')}}
            </div>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'
export default {
}
</script>

<style>

</style>
