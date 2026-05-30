// Defineix la configuracio de rutes i metadades de navegacio.
import { lazy } from 'react'

const HomePage = lazy(() => import('@/pages/HomePage'))
const HeroDetail = lazy(() => import('@/pages/HeroDetail'))
const AccountSettings = lazy(() => import('@/pages/AccountSettings'))
const AuthVerified = lazy(() => import('@/pages/AuthVerified'))
const StoragePolicy = lazy(() => import('@/pages/StoragePolicy'))
const DataSources = lazy(() => import('@/pages/DataSources'))

const formatSlugTitle = (slug) =>
  decodeURIComponent(slug)
    .split('-')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')

export const appRoutes = [
  {
    id: 'home',
    path: '/',
    end: true,
    isHome: true,
    title: ({ appName, t }) => `${appName} | ${t('app.heroVisualizer')}`,
    render: ({ heroes, heroesStatus, authStatus }) => (
      <HomePage heroes={heroes} heroesStatus={heroesStatus} authStatus={authStatus} />
    ),
  },
  {
    id: 'heroDetail',
    path: '/heroes/:slug',
    title: ({ appName, params }) => `${appName} | ${formatSlugTitle(params.slug)}`,
    render: () => <HeroDetail />,
  },
  {
    id: 'account',
    path: '/account',
    title: ({ appName, t }) => `${appName} | ${t('common.account')}`,
    render: ({ openAuthDialog }) => <AccountSettings onRequireSignIn={openAuthDialog} />,
  },
  {
    id: 'authVerified',
    path: '/auth/verified',
    title: ({ appName, t }) => `${appName} | ${t('authVerified.title')}`,
    render: ({ openAuthDialog }) => <AuthVerified onSignInClick={openAuthDialog} />,
  },
  {
    id: 'privacy',
    path: '/privacy',
    title: ({ appName, t }) => `${appName} | ${t('privacy.title')}`,
    render: () => <StoragePolicy />,
  },
  {
    id: 'dataSources',
    path: '/data-sources',
    title: ({ appName, t }) => `${appName} | ${t('dataSources.title')}`,
    render: () => <DataSources />,
  },
]

export const getRouteDocumentTitle = ({ route, params = {}, t }) => {
  const appName = t('common.appName')
  return route?.title?.({ appName, params, t }) ?? `${appName} | ${t('app.heroVisualizer')}`
}
