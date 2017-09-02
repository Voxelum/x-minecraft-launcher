<template>
  <div class="ui grid">
    <div class="four wide column">
      <div class="ui  accordion">
        <div class="active title">
          <i class="dropdown icon"></i>
          Basic
        </div>
        <div class="active content">
          <div class="ui vertical secondary pointing menu">
            <a class="item">
              Settings
            </a>
            <a class="item">
              Resource Packs
            </a>
            <a class="item">
              Mods
            </a>
          </div>
        </div>
        <div class="title">
          <i class="dropdown icon"></i>
          Advanced
        </div>
        <div class="content">
          <div class="ui vertical secondary pointing menu">
            <a class="item">
              Forge
            </a>
            <a class="item">
              Liteloader
            </a>
          </div>
        </div>
      </div>
    </div>
    <div class="thirteen wide column">

    </div>
  </div>
</template>

<script>
export default {
  props: ['id'],
  mounted() {
    $(this.$el).accordion();
  }
}
</script>

<style>

</style>
