import { Ref } from 'vue'

export function useToggleCategories(cats: Ref<string[]>) {
  const toggleCategory = (cat: string) => {
    if (!cats.value.includes(cat)) {
      cats.value.push(cat)
    } else {
      cats.value.splice(cats.value.indexOf(cat), 1)
    }
  }
  return toggleCategory
}
