export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg, #f5f5f0)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#b8860b' }} />
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    </div>
  )
}
