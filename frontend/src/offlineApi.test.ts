import { beforeEach, describe, expect, it } from 'vitest'
import { offlineRequest } from './offlineApi'
import type { NoticeDetail, NoticeSummary } from './api'
import { LocalAuthAdapter, seedLocalDemoAccount } from './auth'

describe('offline API for the personalized UI', () => {
  beforeEach(() => localStorage.clear())

  it('returns personalized seed metadata and notice details', async () => {
    const notices = await offlineRequest<NoticeSummary[]>('/api/notices')
    expect(notices.length).toBe(84)
    expect(notices.some(item => item.colleges?.includes('工程物理学院'))).toBe(true)
    expect(notices.some(item => item.tags?.includes('科研'))).toBe(true)
    expect(notices.some(item => item.id.startsWith('notion_wechat_'))).toBe(true)

    const detail = await offlineRequest<NoticeDetail>(`/api/notices/${notices[0].id}`)
    expect(detail.raw_text).toContain('演示')
    expect(detail.deadline).toBeTruthy()
  })

  it('searches title, body and tags', async () => {
    const results = await offlineRequest<NoticeSummary[]>('/api/notices?query=' + encodeURIComponent('STM32'))
    expect(results).toHaveLength(1)
    expect(results[0].title).toContain('嵌入式')

    const archiveResults = await offlineRequest<NoticeSummary[]>('/api/notices?query=' + encodeURIComponent('知网 AI'))
    expect(archiveResults.some(item => item.id === 'notion_wechat_3df9f5a310dc81768cacc3e7208ea980')).toBe(true)
  })

  it('keeps newly created notices in browser storage', async () => {
    const created = await offlineRequest<NoticeDetail>('/api/notices', {
      method: 'POST',
      body: JSON.stringify({ title: '离线测试', raw_text: '面向对象：全体学生', tags: ['测试'] }),
    })
    const results = await offlineRequest<NoticeSummary[]>('/api/notices?query=' + encodeURIComponent('离线测试'))
    expect(results.map(item => item.id)).toContain(created.id)
  })

  it('creates and signs in to an offline demo account', async () => {
    await seedLocalDemoAccount('student@demo.test', 'Demo1234')
    const session = await new LocalAuthAdapter().login('student@demo.test', 'Demo1234')
    expect(session.email).toBe('student@demo.test')
  })
})
