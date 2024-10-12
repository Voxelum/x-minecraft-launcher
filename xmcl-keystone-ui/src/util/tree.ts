export type TreeItem<T> = {
  data: T
  depth: number
  index: number
}

export const treeItemKey = (item: TreeItem<any>) => `${item.depth}.${item.index}`

export const flatTree = <T>(
  items: T[],
  getChildren: (item: T) => T[] | undefined,
  openItems: string[],
  openAll: boolean = false,
  depth = 0,
) => {
  return items
    .flatMap((item, index) => {
      const children = getChildren(item)

      const base: TreeItem<T> = {
        data: item,
        depth,
        index,
      }

      const data: TreeItem<T>[] = [base]

      let open = openItems.includes(treeItemKey(base))
      if (openAll) open = !open

      if (children && open) data.push(...flatTree(children, getChildren, openItems, openAll, depth + 1))

      return data
    })
    .flat()
}
