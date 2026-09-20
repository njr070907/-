# 架构边界

当前通知链路：`data/raw/*.json` 与 `data/demo_notices.json` → Seed Import → 数据库中的 `Notice` → 提取与人工确认 → `Matter` / `Task` → FastAPI → React。前端另有 `AuthAdapter` / `LocalAuthAdapter` 和 `ProfileRepository` / `LocalProfileRepository`，由页面调用，不在页面中直接读写 LocalStorage。`RecommendationService` 使用纯规则计算排序与理由，不修改后端通知；“全部信息”仍展示完整通知集合。

data/raw 仅用于开发、测试、演示和回归，不是线上数据库。raw_text 是原始证据，导入时原样保存；解析结果放在 extracted_json，不覆盖原文。当前导入来源固定为 manual_copy，parse_status 依次可为 raw、review_required、confirmed。

一条 Notice 只有在用户选择已有事项或新建事项后，才会写入 matter_id。一条已确认的通知可产生一个 Task；没有明确年份截止时间的 Task 不进入本周待办。系统不根据标题自动合并事项，也不自动登录或抓取校方系统。

后续可让公开网页、校方文件、校方 API 或在授权和访问规则明确后的其他来源各自转换为同一 `Notice` 输入。前端继续使用 Notice API。接入 Supabase 时以 `SupabaseAuthAdapter` 替换本地 Auth、以 `SupabaseProfileRepository` 替换本地画像仓储；按 `profiles`、`notices`、`user_actions` 建表，配置 RLS 和服务端授权，再迁移演示数据。现有 LocalStorage Session 无服务端签名，不能用于真实权限控制。现有 SQLite 补列仅服务本地演示，生产数据库应使用正式 schema 迁移。

远期可以补充正式版本表、学校授权数据接入和更完善的提醒机制；本轮已实现手动粘贴通知、处理、人工确认、事项关联、任务和本周待办的基础链路。
