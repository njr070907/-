const { test } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xsq-recommendation-'))
execFileSync(process.execPath, [path.join(process.cwd(), 'node_modules/typescript/bin/tsc'), '--ignoreConfig', '--target', 'es2022', '--module', 'commonjs', '--noCheck', '--outDir', outputDir, 'src/recommendation.ts', 'src/user.ts'])
const { calculateRelevance, rankNotices, upcomingNotices } = require(path.join(outputDir, 'recommendation.js'))
const { COLLEGES, UNDERGRAD_MAJOR_MAP, GRADUATE_PROGRAM_MAP, SPECIAL_PROGRAM_MAP, getPrograms } = require(path.join(outputDir, 'sztuAcademicData.js'))
const { validateKeyword } = require(path.join(outputDir, 'keywordUtils.js'))
fs.rmSync(outputDir, { recursive: true, force: true })
const now = new Date('2026-09-20T08:00:00Z')
const profile = { id: 'a', email: 'a@example.test', displayName: 'A', role: 'undergraduate', college: '工程物理学院', major: '智能感知工程', grade: '2024级', interests: ['竞赛'] }
const notice = (id, fields = {}) => ({ id, title: id, source_name: null, published_at: '2026-09-19T08:00:00Z', source_type: 'manual_copy', parse_status: 'raw', ...fields })

test('old public notice stays visible and gets a truthful reason', () => {
  const result = calculateRelevance(profile, notice('legacy'), now)
  assert.equal(result.applies, true)
  assert.equal(result.expired, false)
  assert.deepEqual(result.reasons, ['面向全校'])
})

test('college, major, interests and role each change relevance', () => {
  const scoped = notice('scoped', { audience_roles: ['undergraduate'], colleges: ['工程物理学院'], majors: ['智能感知工程'], tags: ['竞赛'] })
  const baseline = calculateRelevance(profile, scoped, now)
  assert(baseline.reasons.includes('与你的学院相关'))
  assert(baseline.reasons.includes('与你的专业相关'))
  assert(baseline.score > calculateRelevance({ ...profile, college: '商学院' }, scoped, now).score)
  assert(baseline.score > calculateRelevance({ ...profile, major: '应用物理学' }, scoped, now).score)
  assert(baseline.score > calculateRelevance({ ...profile, interests: [] }, scoped, now).score)
  const wrongRole = calculateRelevance({ ...profile, role: 'teacher' }, scoped, now)
  assert.equal(wrongRole.applies, false)
  assert.deepEqual(wrongRole.reasons, ['不在当前适用范围'])
})

test('required applicable notice wins while expired highly matched notice falls back', () => {
  const required = notice('required', { required: true, deadline: '2026-09-23T08:00:00Z' })
  const expired = notice('expired', { audience_roles: ['undergraduate'], colleges: ['工程物理学院'], majors: ['智能感知工程'], tags: ['竞赛'], deadline: '2026-09-19T08:00:00Z' })
  const ranked = rankNotices(profile, [expired, notice('public'), required], now)
  assert.equal(ranked[0].notice.id, 'required')
  assert.equal(ranked.at(-1).notice.id, 'expired')
  assert.equal(ranked[0].priority, 'HIGH')
  assert(ranked[0].reasons.includes('必须办理'))
})

test('upcoming orders by deadline and excludes expired notices', () => {
  const items = rankNotices(profile, [notice('late', { deadline: '2026-09-29T08:00:00Z' }), notice('soon', { deadline: '2026-09-21T08:00:00Z' }), notice('old', { deadline: '2026-09-19T08:00:00Z' })], now)
  assert.deepEqual(upcomingNotices(items, now).map(item => item.notice.id), ['soon', 'late'])
})

test('three profiles have distinct leading notices', () => {
  const items = [
    notice('undergrad', { audience_roles: ['undergraduate'], colleges: ['工程物理学院'], majors: ['智能感知工程'], tags: ['竞赛'], required: true }),
    notice('graduate', { audience_roles: ['postgraduate'], colleges: ['计算机科学与技术学院'], majors: ['计算机科学与技术'], tags: ['科研'], required: true }),
    notice('teacher', { audience_roles: ['teacher'], colleges: ['信息与通信工程学院'], tags: ['教务'], required: true }),
  ]
  const profiles = [profile,
    { ...profile, role: 'postgraduate', college: '计算机科学与技术学院', major: '计算机科学与技术', interests: ['科研'] },
    { ...profile, role: 'teacher', college: '信息与通信工程学院', major: '', grade: '', interests: ['教务'] }]
  assert.deepEqual(profiles.map(item => rankNotices(item, items, now)[0].notice.id), ['undergrad', 'graduate', 'teacher'])
})

test('official academic options cover each role and special programs', () => {
  assert.equal(COLLEGES.length, 17)
  assert.equal(Object.values(UNDERGRAD_MAJOR_MAP).flat().length, 41)
  assert.equal(Object.values(GRADUATE_PROGRAM_MAP).flat().length, 13)
  assert.equal(SPECIAL_PROGRAM_MAP.future_technology.length, 5)
  assert(SPECIAL_PROGRAM_MAP.future_technology.every(item => item.kind === 'specialProgram'))
  assert.deepEqual(getPrograms('undergraduate', '工程物理学院').map(item => item.displayName), ['应用物理学', '光电信息科学与工程', '智能感知工程'])
  assert(getPrograms('undergraduate', '中德智能制造学院').some(item => item.displayName === '工业软件'))
  assert.equal(getPrograms('undergraduate', '城市交通与物流学院').length, 5)
  assert.equal(getPrograms('undergraduate', '质量和标准学院').length, 0)
  assert.equal(getPrograms('teacher', '工程物理学院').length, 0)
  assert(getPrograms('postgraduate', '人工智能学院').some(item => item.displayName === '计算机技术'))
  assert(!getPrograms('postgraduate', '人工智能学院').some(item => item.displayName === '计算机科学与技术'))
})

test('keyword matching covers title and tags, ignores case and whitespace, and caps interest points', () => {
  const robot = notice('robot', { title: '2026大学生机器人大赛报名通知', tags: ['竞赛'] })
  const withKeyword = { ...profile, customKeywords: [' 机 器 人 ', 'STM32'] }
  const result = calculateRelevance(withKeyword, robot, now)
  assert(result.reasons.includes('匹配你的关注关键词“ 机 器 人 ”'))
  assert(result.reasons.includes('你关注了“竞赛”'))
  assert.equal(result.score, calculateRelevance({ ...profile, customKeywords: [] }, robot, now).score)
  const tagged = notice('tagged', { tags: ['stm32'] })
  assert(calculateRelevance(withKeyword, tagged, now).reasons.includes('匹配你的关注关键词“STM32”'))
  const withMeta = notice('meta', { category: '机器人项目', summary: '报名说明' })
  assert(calculateRelevance(withKeyword, withMeta, now).reasons.some(reason => reason.includes('关注关键词')))
})

test('adding then deleting a custom keyword changes ranking without duplicate points', () => {
  const robot = notice('robot', { title: '机器人项目报名' })
  const generic = notice('generic', { title: '公共事项', importance: 'high' })
  const without = rankNotices({ ...profile, interests: [], customKeywords: [] }, [robot, generic], now)
  const withKeyword = rankNotices({ ...profile, interests: [], customKeywords: ['机器人'] }, [robot, generic], now)
  assert.equal(without[0].notice.id, 'generic')
  assert.equal(withKeyword[0].notice.id, 'robot')
  assert.equal(validateKeyword('机器人', ['机器人']), '这个关键词已经添加过了')
  assert.equal(validateKeyword('STM32', ['stm32']), '这个关键词已经添加过了')
  assert.equal(validateKeyword(' ', []), '请输入关键词')
  assert.equal(validateKeyword('a', []), '每个关键词需要 2–20 个字符')
  assert.equal(validateKeyword('a'.repeat(21), []), '每个关键词需要 2–20 个字符')
  assert.equal(validateKeyword('new', Array.from({ length: 10 }, (_, index) => `word${index}`)), '最多添加 10 个关键词')
})
