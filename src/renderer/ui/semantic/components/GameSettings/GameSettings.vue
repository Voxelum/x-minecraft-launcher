<template>
    <div>
        <div class="ui search selection dropdown">
            <i class="dropdown icon"></i>
            <div class="menu">
                <div class="item">
                    High
                </div>
                <div class="item">
                    Midum
                </div>
                <div class="item">
                    Low
                </div>
            </div>
        </div>
        <div class="ui segment" :class="{disabled : !enableAdvanced}">
             <option-button id="hello" :options="options"></option-button> 
        </div>
    </div>
</template>

<script>
import OptionButton from './OptionButton'

export default {
    data() {
        return {
            options: [
                'edit',
                'create',
                'name',
                'hello',
            ],
            enableAdvanced: true,
        }
    },
    components: { OptionButton },
    // props: ['source', 'id'],
}
</script>

<style>

</style>
