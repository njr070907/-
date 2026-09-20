export const normalizeKeyword = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, '')

export function validateKeyword(input: string, existing: string[]): string | null {
  const keyword = input.trim()
  const length = Array.from(keyword).length
  if (!keyword) return '请输入关键词'
  if (length < 2 || length > 20) return '每个关键词需要 2–20 个字符'
  if (existing.some(item => normalizeKeyword(item) === normalizeKeyword(keyword))) return '这个关键词已经添加过了'
  if (existing.length >= 10) return '最多添加 10 个关键词'
  return null
}
