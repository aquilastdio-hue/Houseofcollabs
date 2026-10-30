import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/index.css'
import { isNativeApp } from '@/lib/native'
import App from './App'

// Inside the apps the page must not zoom: iOS zooms into any text field set
// smaller than 16px when it's tapped, and an app never wants pinch-zoom. The
// website keeps zoom for accessibility.
//
// And no `viewport-fit=cover` there: with it, iOS lays the page out under the
// status bar and home indicator, and every sticky header slides under the
// clock. Without it, the page keeps to the safe area on its own.
if (isNativeApp) {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
  document.documentElement.classList.add('native-app')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
