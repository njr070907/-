# 添加演示通知

`data/raw/` 是团队共享的原始测试数据；网站运行时读取的是数据库。每人约添加 20 条，一条通知一个 JSON 文件。

1. 复制 `raw/example_notice.json`，新文件命名如 `notice_001.json`。请确认文件名和 JSON 内的 `id` 都唯一。
2. 把完整通知正文原样放进 `raw_text`，不要删改原文。`title`、`source_name`、`source_url`、`published_at`、`collected_by`、`collected_at` 不知道就填 `null`，不要猜。
3. `published_at`、`collected_at` 如果填写，使用 ISO 8601 时间，例如 `2026-09-19T09:00:00+08:00`。
4. 只新增自己的文件，不修改其他成员的通知文件。运行根目录 README 中的导入命令；同一个 `id` 再次导入会跳过。

`example_notice.json` 是明确标注的演示数据，不是真实校方通知。提交前检查正文中是否有账号、密码、Cookie、Token 等敏感信息。

## 微信知识库归档

Notion「微信知识库」的完整静态快照存放在 [notion_wechat/](notion_wechat/)。该目录将可阅读的 Markdown 原文、与本目录 JSON 格式对齐的单条原始记录及机器可读索引分开保存。它默认不参与演示数据导入；使用某条记录前，先核对原文、日期和来源，再复制对应 JSON 到本目录。
