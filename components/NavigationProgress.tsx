'use client'
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar'

export default function NavigationProgress() {
  return (
    <ProgressBar
      height="3px"
      color="#b8860b"
      options={{ showSpinner: false }}
      shallowRouting
    />
  )
}
