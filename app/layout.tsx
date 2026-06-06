import './globals.css'
import NavigationProgress from '@/components/NavigationProgress'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata = {
  title: 'A&B Tracker',
  description: 'A&B Consulting Group — Work Order Management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans bg-gray-50 text-gray-900 antialiased`}>
        <NavigationProgress />
        {children}
      </body>
    </html>
  )
}
