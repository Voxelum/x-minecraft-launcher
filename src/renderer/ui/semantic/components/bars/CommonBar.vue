<template>
    <div>
        <div class="ui icon circlar inverted button non-moveable" @click="$emit('refresh')">
            <i class="refresh icon"></i>
        </div>
        <i class="warning sign icon"></i>
        <i class="cloud download icon"></i>
        <i class="tasks icon"></i>
        <div class="ui icon right floated circlar inverted button non-moveable" @click="$emit('create','profile')">
            <i class="plus icon"></i>
            {{$t('profile.add.modpack')}}
        </div>
        <div class="ui icon right floated circlar inverted button non-moveable" @click="$emit('create','server')">
            <i class="plus icon"></i>
            {{$t('profile.add.server')}}
        </div>
    </div>
</template>

<script>
export default {
}
</script>

<style>

</style>
