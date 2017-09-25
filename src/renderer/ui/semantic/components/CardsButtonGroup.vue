<template>
    <span>
        <div class="ui icon right floated inverted button non-moveable" @click="$emit('modal','modpack')">
            <i class="plus icon"></i>
            {{$t('modpack.add')}}
        </div>
        <div class="ui icon right floated inverted button non-moveable" @click="$emit('modal','server')">
            <i class="plus icon"></i>
            {{$t('server.add')}}
        </div>
    </span>
</template>

<script>
export default {
    
}
</script>

<style>

</style>
