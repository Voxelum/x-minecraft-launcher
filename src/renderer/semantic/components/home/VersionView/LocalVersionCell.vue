<template>
    <tr style="cursor: pointer;" :url="meta.url" :version-id='meta.id' @click="$emit('select', meta)">
        <td>
            {{meta.id}}
            <i v-if="selected" class="ui green check icon"></i>
        </td>
        <td>{{meta.minecraft}}</td>
        <td>{{meta.forge || 'None'}}</td>
        <td>{{meta.liteloader || 'None'}}</td>
    </tr>
</template>

<script>
export default {
    props: ['meta', 'selected']
}
</script>

<style>

</style>
