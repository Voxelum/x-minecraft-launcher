const colors = [
  'amber',
  'orange lighten-1',
  'pink lighten-3',
  'deep-orange',
  'purple lighten-1',
  'lime',
]

export function getColor(name: string) {
  let code = 0
  for (let i = 0; i < name.length; ++i) {
    code += name.charCodeAt(i)
  }

  return colors[code % colors.length]
}

export function getColorForReleaseType(type: 'release' | 'alpha' | 'beta' | 1 | 2 | 3 | string | number) {
  switch (type) {
    case 1:
    case 'release': return 'green'
    case 3:
    case 'alpha': return 'red'
    case 2:
    case 'beta': return 'orange'
    default:
      return ''
  }
}
