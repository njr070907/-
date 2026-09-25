// Mirrors _extract_deadline in backend/app/services/notice_processing.py so the
// offline build reads deadlines the same way as the API. Both are tested against
// data/expected/deadline_cases.json.

type DateMention = {
  start: number
  end: number
  year: number | null
  month: number
  day: number
  time: [number, number] | null
}

type Groups = Record<string, string | undefined>

const gap = '[ \\t\\u3000]*'
const weekday = `(?:${gap}[（(](?:星期|周|礼拜)[一二三四五六日天][）)])?`
const time = `(?:${gap}(?<period>上午|早上|中午|下午|傍晚|晚上)?${gap}(?<hour>\\d{1,2})${gap}`
  + `(?:[:：]${gap}(?<minute>\\d{2})|[点时](?:(?<half>半)|(?<cnMinute>\\d{1,2})分?)?))?`
const dateMentionSource = `(?:(?<year>\\d{4})${gap}年${gap})?(?<month>\\d{1,2})${gap}月${gap}(?<day>\\d{1,2})${gap}[日号]`
  + weekday + time
const rangeEndSource = `${gap}(?:至|到|~|～|—{1,2}|–|-)${gap}(?:(?<year>\\d{4})${gap}年${gap})?`
  + `(?:(?<month>\\d{1,2})${gap}月${gap})?(?<day>\\d{1,2})${gap}[日号]` + weekday + time

const clauseBreaks = new Set('\n。；;！!？?，,')
const deadlineWords = ['截止', '截至', '逾期', '最晚', '最迟', '不晚于']
const deadlineSuffixes = ['前', '之前', '以前']
const updateWords = ['调整为', '变更为', '更新为', '修改为', '改为', '延长至', '推迟至', '延期至']
const publishWords = ['发布', '发文', '印发', '更新时间', '更新于']
const labelWords = ['时间', '日期']

export function extractDeadline(rawText: string): { deadline: string | null; evidence: string | null } {
  let best: DateMention | null = null
  let bestScore = 0
  for (const mention of dateMentions(rawText)) {
    const score = deadlineScore(rawText, mention)
    if (score !== null && score > bestScore) { best = mention; bestScore = score }
  }
  if (!best) return { deadline: null, evidence: null }

  const evidence = rawText.slice(best.start, best.end).trim()
  if (best.year === null) return { deadline: null, evidence }
  const value = `${pad(best.year, 4)}-${pad(best.month)}-${pad(best.day)}`
  return { deadline: best.time ? `${value}T${pad(best.time[0])}:${pad(best.time[1])}` : value, evidence }
}

function dateMentions(text: string): DateMention[] {
  const pattern = new RegExp(dateMentionSource, 'g')
  const rangeEnd = new RegExp(rangeEndSource, 'y')
  const mentions: DateMention[] = []
  let consumed = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    const start = match.index
    // Same as the backend's (?<!\d); lookbehind is avoided for older mobile Safari.
    if (start > 0 && /\d/.test(text[start - 1])) { pattern.lastIndex = start + 1; continue }
    if (start < consumed) continue
    const groups = match.groups as Groups
    const year = groups.year ? Number(groups.year) : null
    const month = Number(groups.month)
    const day = Number(groups.day)
    if (!isValidDate(year, month, day)) continue
    let mention: DateMention = { start, end: pattern.lastIndex, year, month, day, time: parseTime(groups) }

    rangeEnd.lastIndex = pattern.lastIndex
    const range = rangeEnd.exec(text)
    if (range) {
      const endGroups = range.groups as Groups
      const endMonth = endGroups.month ? Number(endGroups.month) : month
      const endDay = Number(endGroups.day)
      // "2026年12月28日至1月5日" ends in the following year.
      const endYear = endGroups.year ? Number(endGroups.year) : year !== null ? year + (endMonth < month ? 1 : 0) : null
      if (isValidDate(endYear, endMonth, endDay)) {
        mention = { start, end: rangeEnd.lastIndex, year: endYear, month: endMonth, day: endDay, time: parseTime(endGroups) }
      }
    }

    consumed = mention.end
    mentions.push(mention)
  }
  return mentions
}

function isValidDate(year: number | null, month: number, day: number): boolean {
  const fullYear = year ?? 2000 // 2000 allows 2月29日
  if (fullYear < 1) return false
  const date = new Date(0)
  date.setUTCFullYear(fullYear, month - 1, day)
  return date.getUTCFullYear() === fullYear && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function parseTime(groups: Groups): [number, number] | null {
  if (groups.hour === undefined) return null
  let hour = Number(groups.hour)
  const minute = groups.minute !== undefined ? Number(groups.minute)
    : groups.half ? 30
      : groups.cnMinute !== undefined ? Number(groups.cnMinute) : 0

  const period = groups.period
  if ((period === '下午' || period === '傍晚' || period === '晚上') && hour >= 1 && hour < 12) hour += 12
  else if (period === '中午' && hour >= 1 && hour < 11) hour += 12
  else if (period === '晚上' && hour === 12) hour = 24
  if (hour === 24 && minute === 0) return [23, 59] // "24:00前" means before the end of that day.
  if (hour > 23 || minute > 59) return null
  return [hour, minute]
}

function deadlineScore(text: string, mention: DateMention): number | null {
  let left = mention.start
  while (left > 0 && !clauseBreaks.has(text[left - 1])) left -= 1
  let right = mention.end
  while (right < text.length && !clauseBreaks.has(text[right])) right += 1
  const before = text.slice(left, mention.start)
  const clause = text.slice(left, right)
  const after = text.slice(mention.end, right).trimStart()

  if (updateWords.some(word => before.includes(word))) return 4
  if (deadlineWords.some(word => clause.includes(word)) || deadlineSuffixes.some(word => after.startsWith(word))) return 3
  if (publishWords.some(word => clause.includes(word))) return null
  if (labelWords.some(word => before.includes(word))) return 2
  return 1
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}
