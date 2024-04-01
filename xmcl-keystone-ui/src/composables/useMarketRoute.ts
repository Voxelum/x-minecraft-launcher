export function useSearchInMcWiki() {
  function searchInMcWiki(name: string) {
    window.open(`https://www.mcmod.cn/s?key=${name}`, 'browser')
  }
  return {
    searchInMcWiki,
  }
}
