<template>
  <div style="height: 100%">
    <webview
      ref="view"
      :src="url"
      style="display:inline-flex; width:100%; height:100%"
      useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36 Edg/84.0.522.39"
      webpreferences="javascript=yes"
      partition="persist:mcwiki"
    />
  </div>
</template>

<script lang=ts>
import { defineComponent, computed, ref, Ref, onMounted } from '@vue/composition-api'
import { WebviewTag } from 'electron'
import { useRouter } from '/@/hooks'
import { optional } from '/@/util/props'

export default defineComponent({
  props: {
    path: optional(String),
  },
  setup(props) {
    const view: Ref<WebviewTag | null> = ref(null)
    function isMcWikiHost(u: string) {
      const url = new URL(u)
      return url.host === 'www.mcmod.cn' || 'play.mcmod.cn'
    }
    function isCurseforge(u: string) {
      const url = new URL(u)
      return url.host === 'www.curseforge.com'
    }
    const url = computed(() => {
      let initUrl = 'https://www.mcmod.cn/'
      if (props.path) {
        if (!isMcWikiHost(decodeURIComponent(props.path))) {
          initUrl = 'https://www.mcmod.cn/'
        } else {
          initUrl = decodeURIComponent(props.path)
        }
      } else {
        initUrl = 'https://www.mcmod.cn/'
      }
      return initUrl
    })
    const { replace } = useRouter()
    onMounted(() => {
      const webview: WebviewTag = view.value!

      webview.addEventListener('dom-ready', () => {
        webview.openDevTools()

        if (url.value === 'https://www.mcmod.cn/' || url.value === 'https://www.mcmod.cn') {
          webview.executeJavaScript(`
          const parent = document.querySelector('.tag_block').parentElement;
          const tag = document.querySelector('.tag_block');
          const star = document.querySelector('.star_block');
          const list = document.querySelector('.list_block');
          parent.removeChild(tag);
          parent.removeChild(star);
          parent.insertBefore(tag, list);
          parent.insertBefore(star, list);

          const video = document.querySelector('.video_block');
          video.parentElement.removeChild(video);
          document.querySelector('.topic_block').appendChild(video);

          const door = document.querySelector('.door');
          const right = document.querySelector('.news_block .right');
          door.parentElement.removeChild(door);
          right.parentElement.insertBefore(door, right);
          let first = document.querySelector('.top-main .navs').children[1];
          let sec = document.querySelector('.top-main .navs').children[3];
          first.remove();
          sec.remove();
        `)
        }

        // .top-main.clearfix { display: none; }

        webview.insertCSS(
          `
        .nav { display: none; }
        .news_block .door { margin-right: 150px; }
        .az_block { width: 500px important!; display: none; }
        html,body { background: transparent !important; width: 100%; overflow-x: hidden; }
        body { overflow-y: hidden; }
        ::-webkit-scrollbar { width: 2px !important; background: transparent !important; }
        ::-webkit-scrollbar-thumb {  background: #888; }
        ::-webkit-scrollbar-track { background: transparent !important; }
        .col-lg-12 common-center { background: transparent !important; }
        .common-center { background: transparent !important; border: none !important; }
        .common-center .right .class-info .col-lg-4 { color: white !important; }
        .common-text p { color: white !important; }
        .class-menu-main .text-area li {  background: transparent !important; }

        h1, h2, h3, h4, h5, h6 { color: white !important; }
        .common-nav { background: transparent !important; }

        p { color: white; }

        footer { background: transparent !important; }
        
        div, a, ul, li { color: white !important; }
        .chart_block .list li a { color: white !important; }
        .list_block .list li a { color: white !important; }
        .list_block { width: 90% !important }
        
        .news_block .left .name a { color: white !important }
        .post_block .list li .postTitle a { color: white !important }
        .card_block ul li a { color: white !important }
        .class_block .left .list .name a { background: transparent !important; color: white !important; }
        .class_block .left .list { display: flex; flex-wrap: wrap;  }
        .class_block .left .list .frame { margin-right: 5px !important; margin-bottom: 5px; !important; }
        .class_block .right #day li a, .class_block .right #week li a, .class_block .right #moon li a { width: 100px !important; }
        .class_block .right .list .no1 { height: 120px !important; }

        .news_block { width: 700px !important; padding-right }
        .main { width: 700px !important;  }
        .main .nav ul { background: transparent !important;  }
        .main .nav ul li.t1 { background: transparent !important;  }
        .main .nav ul li.t2 { background: transparent !important;  }
        .main .nav ul li.t3 { background: transparent !important;  }
        .main .nav ul li.t4 { background: transparent !important;  }
        .main .nav ul li.t5 { background: transparent !important;  }
        .main .nav ul li.t6 { background: transparent !important;  }
        .main .nav ul li.t23 { background: transparent !important;  }
        .main .nav ul li.t24 { background: transparent !important;  }
        .main .nav ul li.t7 { background: transparent !important;  }
        .class_block { width: 700px !important; }
        .class_block .left { width: 75% !important; }
        .class_block .right { width: 25% !important; }
        .banner { display: none; }
        .az_block .list_frame { width: 90% !important; }
        .az_block .list { width: 90% !important; }
        .az_block .area { width: 500px !important; }
        .chart_block { width: 65% !important; }
        .topic_block { width: 30% !important; }
        .post_frame { width: 50% !important; }
        .post_block { width: 100% !important; }
        .post_block .list { width: 100%  !important; display: flex; flex-wrap: wrap; }
        .un_links .block { display: flex !important; flex-flow: wrap !important; width: 500px !important; }

        .pages_system .Pbtn { background: transparent !important; }
        .pages_system .Pbtn, .pages_system .Pbtn_on { background: transparent !important; }
        .top .logo, .class_block .title #icon1, .class_block .title #icon2, .class_block .title #icon3, .class_block .title #icon4, .block_hot .item #icon1, .block_hot .item #icon2, .mbx_left, .mbx_right, .mbx .line, .mbx, .mbx .home { background: #343434 !important; }
        .mbx { width: 600px !important; }

        .top-main.frame, .tools_box .block, .un_info { width: 600px !important; }
        .top-main.frame { background: #424242 !important; }
        .top-main .logo { display: none !important; }
        .def-nav current has-pulldown-special { display: none !important; }

        .webui-popover-title,.webui-popover { background: #424242 !important; }

        .un_info .block { width: 500px !important; width: 100% !important; height: unset !important; }
        .un_links { background: transparent !important; }
        .un_info { height: 500px !important; }
        .un_info .logo { margin: 60px 200px 0 200px !important; }
        #showsectime { position: unset !important; margin: unset !important; }
        .under { background: transparent !important; }
        .background-color { background: transparent !important; }

        .class-excount .infos .span .n { color: white !important; }
        .class-excount .infos { background: #424242 !important; }
        .class-menu-page { background: transparent !important; }
        `,
        )
      })
      webview.addEventListener('new-window', (e) => {
        if (isMcWikiHost(e.url)) {
          if (e.url.startsWith('https://www.mcmod.cn/jump/')) {
            const url = atob(e.url.substring('https://www.mcmod.cn/jump/'.length))
            if (isCurseforge(url)) {
              replace(`/curseforge/mc-mods?search=${url.substring(url.lastIndexOf('/') + 1)}`)
            } else {
              replace(`external/${url}`)
            }
          } else {
            replace(`/mcwiki?path=${encodeURIComponent(e.url)}`)
          }
        }
      })
    })
    return { view, url }
  },
})
</script>
