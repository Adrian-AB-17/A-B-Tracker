'use client'

export default function LoginForm() {
  return (
    <form method="POST" action="/api/login" className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
        <input name="email" type="email" required autoComplete="email"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
        <input name="password" type="password" required autoComplete="current-password"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <button type="submit"
        className="w-full py-2.5 rounded-lg font-semibold text-white"
        style={{ background: '#1a2b4a' }}>
        Sign in
      </button>
    </form>
  )
}