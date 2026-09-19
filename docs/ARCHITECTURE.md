# 架构边界

当前链路：data/raw/*.json → Seed Import → 数据库中的 Notice → 提取与人工确认 → Matter / Task → FastAPI → React。

data/raw 仅用于开发、测试、演示和回归，不是线上数据库。raw_text 是原始证据，导入时原样保存；解析结果放在 extracted_json，不覆盖原文。当前导入来源固定为 manual_copy，parse_status 依次可为 raw、review_required、confirmed。

一条 Notice 只有在用户选择已有事项或新建事项后，才会写入 matter_id。一条已确认的通知可产生一个 Task；没有明确年份截止时间的 Task 不进入本周待办。系统不根据标题自动合并事项，也不自动登录或抓取校方系统。

后续可让公开网页、校方文件、校方 API 或在授权和访问规则明确后的其他来源各自转换为同一 `Notice` 输入。前端继续使用 Notice API。更换 PostgreSQL 时需要安装数据库驱动、设置 `DATABASE_URL`、做正式 schema 迁移和数据迁移；API 与前端无需因数据库种类而重写。

远期可以补充正式版本表、学校授权数据接入和更完善的提醒机制；本轮已实现手动粘贴通知、处理、人工确认、事项关联、任务和本周待办的基础链路。
