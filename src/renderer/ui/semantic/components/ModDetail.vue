<template>
    <div class="ui items">
        <div class="item">
            <div class="image">
                <img src="/images/wireframe/image.png">
            </div>
            <div class="content">
                <a class="header">Header</a>
                <div class="meta">
                    <span>Description</span>
                </div>
                <div class="description">
                    <p>{{mod.description}}</p>
                </div>
                <div class="extra">
                    Additional Details
                </div>
            </div>
        </div>
    </div>
</template>
<script>
export default {
    data: () => ({
        mod: {
            modid: 'lucaisgenius',
            name: 'luca',
            authors: [
                "a", "b"
            ]
            ,
            description: "hahahah is sooooo fun",
            version: "0.00.0.0.0.0",
            mcversion: "0.0.0..00",
        }
    })
};
</script>

<style>

</style>
