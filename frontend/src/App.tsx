import { useEffect, useState } from 'react'
import { getHealth, getNotice, getNotices, type NoticeDetail, type NoticeSummary } from './api'

export default function App() {
  const [connected, setConnected] = useState(false)
  const [notices, setNotices] = useState<NoticeSummary[]>([])
  const [selected, setSelected] = useState<NoticeDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getHealth()
      .then((health) => { if (active) setConnected(health.status === 'ok') })
      .catch(() => { if (active) setConnected(false) })
    getNotices()
      .then((items) => { if (active) setNotices(items) })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : '无法读取通知')
      })
    return () => { active = false }
  }, [])

  async function selectNotice(id: string) {
    setError(null)
    try {
      setSelected(await getNotice(id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法读取通知详情')
    }
  }

  return (
    <main>
      <h1>校事清 MVP</h1>
      <p>Backend Status: {connected ? 'Connected' : 'Disconnected'}</p>
      <p>Database Notices: {notices.length} 条</p>
      {error && <p role="alert">{error}</p>}
      <h2>Recent Notices</h2>
      <ul>
        {notices.map((notice) => (
          <li key={notice.id}>
            <button type="button" onClick={() => void selectNotice(notice.id)}>
              {notice.title || '未提供标题'}
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <section aria-label="通知详情">
          <h2>{selected.title || '未提供标题'}</h2>
          <p>来源：{selected.source_name || '未提供'}</p>
          <pre>{selected.raw_text}</pre>
        </section>
      )}
    </main>
  )
}
