# 架构边界

当前通知链路：`data/raw/*.json` 与 `data/demo_notices.json` → Seed Import → 数据库中的 `Notice` → FastAPI → React。前端另有 `AuthAdapter` / `LocalAuthAdapter` 和 `ProfileRepository` / `LocalProfileRepository`，由页面调用，不在页面中直接读写 LocalStorage。`RecommendationService` 使用纯规则计算排序与理由，不修改或隐藏后端通知。

`data/raw` 仅用于开发、测试、演示和回归，不是线上数据库。`raw_text` 是原始证据，导入时原样保存；未来的解析结果应放在其他字段或模型中，不覆盖它。当前导入来源固定为 `manual_copy`，`parse_status` 固定为 `raw`。

后续可让公开网页、校方文件、校方 API 或在授权和访问规则明确后的其他来源各自转换为同一 `Notice` 输入。前端继续使用 Notice API。接入 Supabase 时以 `SupabaseAuthAdapter` 替换本地 Auth、以 `SupabaseProfileRepository` 替换本地画像仓储；按 `profiles`、`notices`、`user_actions` 建表，配置 RLS 和服务端授权，再迁移演示数据。现有 LocalStorage Session 无服务端签名，不能用于真实权限控制。现有 SQLite 补列仅服务本地演示，生产数据库应使用正式 schema 迁移。

远期业务链可能是：数据来源 → Ingestion → Notice → Processing → Matter → MatterVersion → Todo。本轮只实现 Notice 链路。
