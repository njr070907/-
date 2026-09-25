import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PersonalizedApp from './PersonalizedApp'
import { authService } from './auth'
import { profileRepository } from './profiles'

const notices = vi.hoisted(() => {
  const notice = (id: string, title: string, parseStatus: string) => ({
    id, title, source_name: null, published_at: null, source_type: 'manual_copy', parse_status: parseStatus, matter_id: null,
  })
  return [
    notice('seed', '学校公开通知', 'raw'),
    notice('draft', '尚未确认的草稿', 'review_required'),
    notice('confirmed', '已确认的通知', 'confirmed'),
  ]
})

vi.mock('./api', async (importOriginal) => ({
  ...await importOriginal<typeof import('./api')>(),
  getHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  getNotice: vi.fn(),
  getNotices: vi.fn().mockResolvedValue(notices),
}))

describe('信息广场', () => {
  beforeEach(async () => {
    localStorage.clear()
    const session = await authService.register('feed@example.test', 'secret1')
    profileRepository.save({
      id: session.userId, email: session.email, displayName: '周老师', role: 'teacher',
      college: '人工智能学院', major: '', grade: '', interests: [], customKeywords: [],
    })
  })

  it('不展示工作台里尚未确认的草稿', async () => {
    render(<PersonalizedApp />)

    expect(await screen.findByText(/学校公开通知/)).toBeInTheDocument()
    expect(screen.getByText(/已确认的通知/)).toBeInTheDocument()
    expect(screen.queryByText(/尚未确认的草稿/)).not.toBeInTheDocument()
  })
})
