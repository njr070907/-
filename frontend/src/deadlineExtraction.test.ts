import { describe, expect, it } from 'vitest'
import cases from '../../data/expected/deadline_cases.json'
import { extractDeadline } from './deadlineExtraction'
import { offlineRequest } from './offlineApi'
import type { NoticeDetail } from './api'

describe('截止时间提取与后端一致', () => {
  it.each(cases)('$name', ({ text, deadline, evidence }) => {
    expect(extractDeadline(text)).toEqual({ deadline, evidence })
  })

  it('离线版提取接口使用同一规则', async () => {
    const created = await offlineRequest<NoticeDetail>('/api/notices', {
      method: 'POST',
      body: JSON.stringify({ raw_text: '时间：2026年9月18日下午4:15—5:15' }),
    })
    const extracted = await offlineRequest<NoticeDetail>(`/api/notices/${created.id}/extract`, { method: 'POST' })
    expect(extracted.extracted_json?.deadline).toBe('2026-09-18T16:15')
  })
})
