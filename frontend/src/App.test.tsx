import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

const api = vi.hoisted(() => ({
  createNotice: vi.fn(),
  extractNotice: vi.fn(),
  getHealth: vi.fn(),
  getMatter: vi.fn(),
  getMatters: vi.fn(),
  getNotice: vi.fn(),
  getNotices: vi.fn(),
  getWeekTasks: vi.fn(),
}))

vi.mock('./api', () => ({
  ...api,
  compareMatterNotices: vi.fn(),
  confirmNotice: vi.fn(),
  updateTask: vi.fn(),
}))

describe('校事清主流程', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getHealth.mockResolvedValue({ status: 'ok' })
    api.getNotices.mockResolvedValue([])
    api.getMatters.mockResolvedValue([])
    api.getWeekTasks.mockResolvedValue([])
  })

  it('提供四个手机端主入口', async () => {
    render(<App />)

    expect((await screen.findAllByRole('button', { name: '添加通知' })).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: '事项' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: '我的本周' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: '搜索' }).length).toBeGreaterThan(0)
  })

  it('正文为空时不发送请求并显示错误', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /保存并提取/ }))

    expect(await screen.findByText('请粘贴通知原文')).toBeInTheDocument()
    expect(api.createNotice).not.toHaveBeenCalled()
  })

  it('网络不可用时保留原文并显示中文重试提示', async () => {
    api.createNotice.mockRejectedValue(new Error('Failed to fetch'))
    render(<App />)

    fireEvent.change(await screen.findByLabelText(/原文正文/), {
      target: { value: '断网后仍需保留的通知正文' },
    })
    fireEvent.click(screen.getByRole('button', { name: /保存并提取/ }))

    expect(await screen.findByText('保存或提取失败，请稍后重试。请检查网络连接或稍后重试。')).toBeInTheDocument()
    expect(screen.getByDisplayValue('断网后仍需保留的通知正文')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /保存并提取/ })).toBeEnabled()
  })

  it('保存通知后进入可编辑的人工确认页', async () => {
    api.createNotice.mockResolvedValue({
      id: 'notice_1',
      title: '奖学金通知',
      source_name: '学院',
      source_url: null,
      published_at: null,
      source_type: 'manual_copy',
      parse_status: 'raw',
      matter_id: null,
      raw_text: '请于2026年9月21日18:30前提交申请表。',
      collected_by: null,
      collected_at: null,
      imported_at: '2026-09-19T00:00:00Z',
      created_at: '2026-09-19T00:00:00Z',
      extracted_json: null,
    })
    api.extractNotice.mockResolvedValue({
      ...(await api.createNotice()),
      parse_status: 'review_required',
      extracted_json: {
        matter_name: '奖学金通知',
        audience: [],
        stage: '',
        deadline: '2026-09-21T18:30',
        submit_channel: '',
        materials: ['申请表'],
        explicit_change: '',
        confidence: 0.43,
        evidence: [{ field: 'deadline', text: '2026年9月21日18:30' }],
      },
    })

    render(<App />)
    fireEvent.change(screen.getByLabelText(/原文正文/), {
      target: { value: '请于2026年9月21日18:30前提交申请表。' },
    })
    fireEvent.click(screen.getByRole('button', { name: /保存并提取/ }))

    await waitFor(() => expect(api.extractNotice).toHaveBeenCalledWith('notice_1'))
    expect(await screen.findByRole('heading', { name: '核对提取结果' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-09-21T18:30')).toBeInTheDocument()
    expect(screen.getByText('2026年9月21日18:30')).toBeInTheDocument()
  })
})
