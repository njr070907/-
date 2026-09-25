import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNotice, getNotice } from './api'
import { isHttpUrl } from './sourceUrl'

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('API 错误信息', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('把 422 校验错误列表转成可读文字，而不是 [object Object]', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      detail: [{ loc: ['body', 'source_url'], msg: 'Value error, source_url must start with http:// or https://' }],
    }, 422)))

    await expect(createNotice({ raw_text: '通知', source_url: 'javascript:alert(1)' }))
      .rejects.toThrow('提交内容格式不正确：Value error, source_url must start with http:// or https://')
  })

  it('保留普通错误的 detail 文本', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Notice not found' }, 404)))

    await expect(getNotice('missing')).rejects.toThrow('Notice not found')
  })
})

describe('来源链接', () => {
  it('只接受 http(s) 链接', () => {
    expect(isHttpUrl('https://example.edu/notice')).toBe(true)
    expect(isHttpUrl(' http://example.edu ')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('data:text/html,hi')).toBe(false)
    expect(isHttpUrl('example.edu')).toBe(false)
    expect(isHttpUrl(null)).toBe(false)
  })
})
