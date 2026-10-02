import * as React from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import PublicLayout from '@/layouts/PublicLayout'
import AuthLayout from '@/layouts/AuthLayout'
import { GuestOnly, RequireAuth, RequireRole } from './guards'
import { RouteError } from './route-error'

/** Route-level code splitting; `props` are type-checked against the page component. */
function page<P extends object>(load: () => Promise<{ default: React.ComponentType<P> }>, props?: P): Pick<RouteObject, 'lazy'> {
  return {
    lazy: async () => {
      const mod = await load()
      const Component = mod.default
      return props ? { element: <Component {...props} /> } : { Component: Component as React.ComponentType }
    },
  }
}

type LegalDoc = 'privacy' | 'terms' | 'cookie-policy' | 'creator-guidelines' | 'brand-guidelines' | 'refund-policy' | 'payout-policy'
const legal = (doc: LegalDoc) => page(() => import('@/pages/public/LegalPage'), { doc })

const BrandLayout = React.lazy(() => import('@/layouts/BrandLayout'))
const CreatorLayout = React.lazy(() => import('@/layouts/CreatorLayout'))
const AdminLayout = React.lazy(() => import('@/layouts/AdminLayout'))

const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      // ------------------------------------------------------------------ public
      {
        element: <PublicLayout />,
        children: [
          { index: true, ...page(() => import('@/pages/public/Home')) },
          { path: 'get-started', ...page(() => import('@/pages/public/GetStarted')) },
          // Collabs / Creators are gated: the landing buttons point straight
          // here, RequireAuth bounces a signed-out visitor to /login?redirect=…
          // and GuestOnly brings them back after they sign in.
          {
            element: <RequireAuth />,
            children: [
              { path: 'collabs', ...page(() => import('@/pages/public/ComingSoon'), { side: 'brand' }) },
              { path: 'creators', ...page(() => import('@/pages/public/ComingSoon'), { side: 'creator' }) },
            ],
          },
          { path: 'about', ...page(() => import('@/pages/public/About')) },
          { path: 'discover', ...page(() => import('@/pages/public/Discover')) },
          { path: 'creators/:slug', ...page(() => import('@/pages/public/CreatorStorefront')) },
          { path: 'categories/:slug', ...page(() => import('@/pages/public/CategoryPage')) },
          { path: 'contact', ...page(() => import('@/pages/public/Contact')) },
          { path: 'privacy', ...legal('privacy') },
          { path: 'terms', ...legal('terms') },
          { path: 'cookie-policy', ...legal('cookie-policy') },
          { path: 'creator-guidelines', ...legal('creator-guidelines') },
          { path: 'brand-guidelines', ...legal('brand-guidelines') },
          { path: 'refund-policy', ...legal('refund-policy') },
          { path: 'payout-policy', ...legal('payout-policy') },
          { path: '*', ...page(() => import('@/pages/public/NotFound')) },
        ],
      },

      // -------------------------------------------------------------------- auth
      {
        element: <AuthLayout />,
        children: [
          {
            element: <GuestOnly />,
            children: [
              { path: 'login', ...page(() => import('@/pages/auth/Login')) },
              { path: 'forgot-password', ...page(() => import('@/pages/auth/ForgotPassword')) },
            ],
          },
          // Outside `GuestOnly` on purpose: both links arrive carrying a
          // session, and GuestOnly would bounce the visitor to a dashboard
          // before they ever got to choose a password.
          { path: 'reset-password', ...page(() => import('@/pages/auth/ResetPassword')) },
          { path: 'set-password', ...page(() => import('@/pages/auth/SetPassword')) },
          { path: 'auth/callback', ...page(() => import('@/pages/auth/AuthCallback')) },
        ],
      },
      {
        path: 'onboarding',
        element: <RequireAuth />,
        children: [{ index: true, ...page(() => import('@/pages/auth/Onboarding')) }],
      },

      // ------------------------------------------------------------------- brand
      {
        path: 'brand',
        element: (
          <RequireRole role="brand">
            <BrandLayout />
          </RequireRole>
        ),
        children: [
          { index: true, ...page(() => import('@/pages/brand/Dashboard')) },
          { path: 'creators', ...page(() => import('@/pages/brand/Marketplace')) },
          { path: 'creators/:id', ...page(() => import('@/pages/brand/CreatorProfile')) },
          { path: 'compare', ...page(() => import('@/pages/brand/Compare')) },
          { path: 'checkout/:serviceId', ...page(() => import('@/pages/brand/Checkout')) },
          { path: 'orders', ...page(() => import('@/pages/brand/Orders')) },
          { path: 'orders/:id', ...page(() => import('@/pages/shared/OrderDetail'), { perspective: 'brand' }) },
          { path: 'briefs', ...page(() => import('@/pages/brand/Briefs')) },
          { path: 'briefs/new', ...page(() => import('@/pages/brand/BriefEditor')) },
          { path: 'briefs/:id', ...page(() => import('@/pages/shared/BriefDetail'), { perspective: 'brand' }) },
          { path: 'briefs/:id/edit', ...page(() => import('@/pages/brand/BriefEditor')) },
          { path: 'wishlists', ...page(() => import('@/pages/brand/Wishlists')) },
          { path: 'notifications', ...page(() => import('@/pages/shared/Notifications'), { perspective: 'brand' }) },
          { path: 'settings', element: <Navigate to="/brand/settings/profile" replace /> },
          { path: 'settings/profile', ...page(() => import('@/pages/brand/settings/ProfileSettings')) },
          { path: 'settings/contact', ...page(() => import('@/pages/brand/settings/ContactSettings')) },
          { path: 'settings/security', ...page(() => import('@/pages/shared/SecuritySettings'), { perspective: 'brand' }) },
          { path: 'settings/billing', ...page(() => import('@/pages/brand/settings/BillingSettings')) },
        ],
      },

      // ----------------------------------------------------------------- creator
      {
        path: 'creator',
        element: (
          <RequireRole role="creator">
            <CreatorLayout />
          </RequireRole>
        ),
        children: [
          { index: true, ...page(() => import('@/pages/creator/Dashboard')) },
          { path: 'profile', ...page(() => import('@/pages/creator/ProfileEditor')) },
          { path: 'portfolio', ...page(() => import('@/pages/creator/Portfolio')) },
          { path: 'services', ...page(() => import('@/pages/creator/Services')) },
          { path: 'orders', ...page(() => import('@/pages/creator/Orders')) },
          { path: 'orders/:id', ...page(() => import('@/pages/shared/OrderDetail'), { perspective: 'creator' }) },
          { path: 'briefs', ...page(() => import('@/pages/creator/Briefs')) },
          { path: 'briefs/:id', ...page(() => import('@/pages/shared/BriefDetail'), { perspective: 'creator' }) },
          { path: 'earnings', ...page(() => import('@/pages/creator/Earnings')) },
          { path: 'payouts', ...page(() => import('@/pages/creator/Payouts')) },
          { path: 'notifications', ...page(() => import('@/pages/shared/Notifications'), { perspective: 'creator' }) },
          { path: 'settings', element: <Navigate to="/creator/settings/profile" replace /> },
          { path: 'settings/profile', ...page(() => import('@/pages/creator/settings/AccountSettings')) },
          { path: 'settings/social', ...page(() => import('@/pages/creator/settings/SocialSettings')) },
          { path: 'settings/security', ...page(() => import('@/pages/shared/SecuritySettings'), { perspective: 'creator' }) },
        ],
      },

      // ------------------------------------------------------------------- admin
      {
        path: 'admin',
        element: (
          <RequireRole role="admin">
            <AdminLayout />
          </RequireRole>
        ),
        children: [
          { index: true, ...page(() => import('@/pages/admin/Dashboard')) },
          { path: 'people', ...page(() => import('@/pages/admin/People')) },
          { path: 'applications', ...page(() => import('@/pages/admin/Applications')) },
          { path: 'finance', ...page(() => import('@/pages/admin/Finance')) },
          { path: 'briefs', ...page(() => import('@/pages/admin/Briefs')) },
          { path: 'creators', ...page(() => import('@/pages/admin/Creators')) },
          { path: 'creator-ranking', ...page(() => import('@/pages/admin/CreatorRanking')) },
          { path: 'creators/:id', ...page(() => import('@/pages/admin/CreatorDetail')) },
          { path: 'brands', ...page(() => import('@/pages/admin/Brands')) },
          { path: 'brands/:id', ...page(() => import('@/pages/admin/BrandDetail')) },
          { path: 'orders', ...page(() => import('@/pages/admin/Orders')) },
          { path: 'orders/:id', ...page(() => import('@/pages/admin/OrderDetail')) },
          { path: 'payments', ...page(() => import('@/pages/admin/Payments')) },
          { path: 'payouts', ...page(() => import('@/pages/admin/Payouts')) },
          { path: 'disputes', ...page(() => import('@/pages/admin/Disputes')) },
          { path: 'disputes/:id', ...page(() => import('@/pages/admin/DisputeDetail')) },
          { path: 'categories', ...page(() => import('@/pages/admin/Categories')) },
          { path: 'reports', ...page(() => import('@/pages/admin/Reports')) },
          { path: 'notifications', ...page(() => import('@/pages/admin/Notifications')) },
          { path: 'emails', ...page(() => import('@/pages/admin/Emails')) },
          { path: 'content', ...page(() => import('@/pages/admin/Content')) },
          { path: 'settings', ...page(() => import('@/pages/admin/Settings')) },
          { path: 'audit-logs', ...page(() => import('@/pages/admin/AuditLogs')) },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
