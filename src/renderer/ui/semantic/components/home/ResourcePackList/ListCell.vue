<template>
    <div class="dimmable item" style="min-height:50px">
        <div class="ui inverted dimmer">
            <div class="content">
                <div class="center">
                    <div class="ui icon buttons">
                        <div class="ui basic black button" v-if="type === 'remove'" @click="$emit('moveup', val.name)">
                            <i class="arrow up icon"></i>
                        </div>
                        <transition v-if="type==='add'" name="fade" mode="out-in">
                            <div :key="deleting?'a':'b'" class="ui black basic button" @click="ondelete">
                                {{deleting?$t('!delete'):"X"}}
                            </div>
                        </transition>
                        <div v-if="type==='add'" class="ui black basic button" @click="$emit('change',val.name)">{{$t('add')}}</div>
                        <div class="ui basic black button" @click="onexport">
                            Export
                        </div>
                        <div v-if="type==='remove'" class="ui red basic button" @click="$emit('change',val.name)">{{$t('remove')}}</div>
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
        deleting: false,
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
            if (!this.deleting) {
                this.deleting = true
            } else {
                this.$emit('delete', this.val.hash)
                this.deleting = false
            }
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
