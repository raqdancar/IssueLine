// Provide the heroThemes shared library helpers.
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

const moonKnightTheme = {
  '--color-slate-50': '#FFFFFF',
  '--color-slate-100': '#F5F5F5',
  '--color-slate-200': '#E5E5E5',
  '--color-slate-300': '#D4D4D4',
  '--color-slate-400': '#A7A7A7',
  '--color-slate-500': '#787878',
  '--color-slate-600': '#666666',
  '--color-slate-700': '#4A4A4A',
  '--color-slate-800': '#2E2E2E',
  '--color-slate-900': '#000000',
  '--color-slate-950': '#000000',
  '--background': '#FFFFFF',
  '--foreground': '#000000',
  '--card': '#FFFFFF',
  '--card-foreground': '#000000',
  '--popover': '#FFFFFF',
  '--popover-foreground': '#000000',
  '--primary': '#787878',
  '--primary-foreground': '#FFFFFF',
  '--secondary': '#A7A7A7',
  '--secondary-foreground': '#000000',
  '--muted': '#F5F5F5',
  '--muted-foreground': '#4A4A4A',
  '--accent': '#ED2924',
  '--accent-foreground': '#FFFFFF',
  '--destructive': '#ED2924',
  '--border': '#A7A7A7',
  '--input': '#A7A7A7',
  '--ring': '#ED2924',
}

const heroThemesBySlug = {
  'doctor-strange': doctorStrangeTheme,
  'moon-knight': moonKnightTheme,
}

export const resolveHeroThemeStyle = (slug) => {
  if (!slug) return undefined
  return heroThemesBySlug[slug.toLowerCase()]
}
