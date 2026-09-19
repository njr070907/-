# 架构边界

当前链路：`data/raw/*.json` → Seed Import → 数据库中的 `Notice` → FastAPI → React。

`data/raw` 仅用于开发、测试、演示和回归，不是线上数据库。`raw_text` 是原始证据，导入时原样保存；未来的解析结果应放在其他字段或模型中，不覆盖它。当前导入来源固定为 `manual_copy`，`parse_status` 固定为 `raw`。

后续可让公开网页、校方文件、校方 API 或在授权和访问规则明确后的其他来源各自转换为同一 `Notice` 输入。前端继续使用 Notice API。更换 PostgreSQL 时需要安装数据库驱动、设置 `DATABASE_URL`、做正式 schema 迁移和数据迁移；API 与前端无需因数据库种类而重写。

远期业务链可能是：数据来源 → Ingestion → Notice → Processing → Matter → MatterVersion → Todo。本轮只实现 Notice 链路。
