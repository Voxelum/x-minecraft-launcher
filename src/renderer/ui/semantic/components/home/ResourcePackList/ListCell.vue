<template>
    <div class="dimmable item" style="min-height:50px">
        <div class="ui inverted dimmer">
            <div class="content">
                <div class="center">
                    <div class="ui icon buttons">
                        <div v-if="type==='remove'" class="ui red basic button" @click="$emit('change',val.name)">
                            <i class="arrow left icon"></i>
                        </div>
                        <div class="ui basic black button" v-if="type === 'remove'" @click="$emit('moveup', val.name)">
                            <i class="arrow up icon"></i>
                        </div>
                        <div class="ui red basic button" v-if="type !== 'remove'" @click="ondelete">
                            <i class="trash alternate icon"></i>
                        </div>
                        <div class="ui basic black button" @click="onexport">
                            {{$t('export')}}
                        </div>
                        <div v-if="type==='add'" class="ui black basic button" @click="$emit('change',val.name)">
                            <i class="arrow right icon"></i>
                        </div>

                        <div class="ui basic black button" v-if="type === 'remove'" @click="$emit('movedown', val.name)">
                            <i class="arrow down icon"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <img class="ui avatar image" :src="val.meta.icon">
        <div class="content">
            <h3 class="header">
                {{val.name}}
            </h3>
            <div class="description" style="max-width:220px">
                <text-component :source="val.meta.description"></text-component>
            </div>
        </div>
    </div>
</template>

<script>

export default {
    data: () => ({
        timeout: null,
    }),
    mounted() {
        const self = this;

        $(this.$el).dimmer({
            on: 'hover',
            onShow() {
                if (self.timeout != null) {
                    clearTimeout(self.timeout);
                    self.timeout = null;
                }
            },
            onHide() {
                self.timeout = setTimeout(() => {
                    self.deleting = false;
                }, 500);
            }
        })
    },
    props: ['val', 'type'],
    methods: {
        ondelete() {
            this.$emit('delete', this.val.hash)
        },
        onexport() {
            this.$emit('export', this.val.hash);
        }
    }
}
</script>

<style>
.fadee-enter-active,
.fadee-leave-active {
  opacity: 1;
  transition: opacity 0.5s;
}

.fadee-enter,
.fadee-leave-to {
  opacity: 0;
}

.flip-list-move {
  transition: transform 1s;
}
</style>
