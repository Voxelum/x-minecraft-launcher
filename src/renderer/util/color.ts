const colors = [
  "amber",
  "orange lighten-1",
  "pink lighten-3",
  "deep-orange",
  "purple lighten-1",
  "lime",
]

export function getColor(name: string) {
  let code = 0
  for (let i = 0; i < name.length; ++i) {
    code += name.charCodeAt(i)
  }

  return colors[code % colors.length]
}
