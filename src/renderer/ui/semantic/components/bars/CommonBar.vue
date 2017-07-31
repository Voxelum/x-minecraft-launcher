<template>
    <div>
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
