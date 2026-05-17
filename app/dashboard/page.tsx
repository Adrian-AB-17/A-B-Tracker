import { cookies } from 'next/headers'

export default function DashboardPage() {
  const cookieStore = cookies()
  const allCookies = cookieStore.getAll()

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', fontSize: 14 }}>
      <h1>Dashboard - Cookie Inspector</h1>
      <p>Total cookies received: {allCookies.length}</p>
      <h2>All cookies:</h2>
      <pre style={{ background: '#f5f5f5', padding: 10, overflow: 'auto' }}>
        {allCookies.map(c => c.name + ': ' + c.value.substring(0, 60) + '...').join('\n')}
      </pre>
    </div>
  )
}
