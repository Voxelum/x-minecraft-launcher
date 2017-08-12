<template>
    <div class="ui aligned grid">
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="disk outline icon"></i>
                {{$t('resourcepack.available')}}
            </h5>
            <div class="ui relaxed list">
                <list-cell v-for="entry in unselecting" :key="entry.key" :entry="entry" type="add" @change="add"></list-cell>
            </div>
        </div>
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="folder outline icon"></i>
                {{$t('resourcepack.selected')}}
            </h5>
            <div class="ui relaxed list">
                <list-cell v-for="entry in selecting" :key="entry.key" :entry="entry" type="remove" @change="remove"></list-cell>
            </div>
        </div>
    </div>
</template>

<script>
export default {

}
</script>

<style>

</style>
