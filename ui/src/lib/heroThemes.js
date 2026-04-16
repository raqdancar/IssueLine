const doctorStrangeTheme = {
  '--color-slate-50': '#fff8e8',
  '--color-slate-100': '#fff8e8',
  '--color-slate-200': '#fcd581',
  '--color-slate-300': '#fcd581',
  '--color-slate-400': '#d52941',
  '--color-slate-500': '#d52941',
  '--color-slate-600': '#990d35',
  '--color-slate-700': '#990d35',
  '--color-slate-800': '#990d35',
  '--color-slate-900': '#272F5D',
  '--color-slate-950': '#272F5D',
  '--background': '#fff8e8',
  '--foreground': '#990d35',
  '--card': '#FFFFFF',
  '--card-foreground': '#990d35',
  '--popover': '#FFFFFF',
  '--popover-foreground': '#990d35',
  '--primary': '#d52941',
  '--primary-foreground': '#FFFFFF',
  '--secondary': '#fcd581',
  '--secondary-foreground': '#990d35',
  '--muted': '#fff8e8',
  '--muted-foreground': '#990d35',
  '--accent': '#fcd581',
  '--accent-foreground': '#990d35',
  '--destructive': '#d52941',
  '--border': '#fcd581',
  '--input': '#fcd581',
  '--ring': '#990d35',
}

const heroThemesBySlug = {
  'doctor-strange': doctorStrangeTheme,
}

export const resolveHeroThemeStyle = (slug) => {
  if (!slug) return undefined
  return heroThemesBySlug[slug.toLowerCase()]
}
