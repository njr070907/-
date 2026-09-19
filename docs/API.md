# MVP API

本地地址：`http://localhost:8000`；交互文档：`/docs`。字段名统一使用 `snake_case`，时间使用 ISO 8601，未知值为 `null`。

## GET /health

`200 {"status":"ok"}`

## GET /api/notices

返回数据库中的通知摘要，默认不含正文。可用 `?query=MVP` 在标题或原文中做基本关键词搜索。

```json
[
  {
    "id": "example_notice",
    "title": "【演示数据】校事清 MVP 通知",
    "source_name": "团队演示数据",
    "published_at": null,
    "source_type": "manual_copy",
    "parse_status": "raw"
  }
]
```

## GET /api/notices/{id}

返回一条完整通知，包括 `raw_text`、`source_url`、`collected_by`、`collected_at`、`imported_at`、`created_at` 和列表字段。未知 `id` 返回 `404 {"detail":"Notice not found"}`。

## POST /api/notices

手动创建通知。只要求非空 `raw_text`；其他字段可省略或传 `null`。可选时间字段为 `published_at`、`collected_at`。服务端生成 `id`，设置 `source_type=manual_copy` 和 `parse_status=raw`。

```http
POST /api/notices
Content-Type: application/json

{"title":"演示标题","raw_text":"完整原始通知正文","source_name":"演示来源"}
```

成功返回 `201` 和完整通知，例如：

```json
{
  "id": "notice_<服务端生成的 UUID>",
  "title": "演示标题",
  "source_name": "演示来源",
  "published_at": null,
  "source_type": "manual_copy",
  "parse_status": "raw",
  "raw_text": "完整原始通知正文",
  "source_url": null,
  "collected_by": null,
  "collected_at": null,
  "imported_at": "2026-09-19T00:00:00",
  "created_at": "2026-09-19T00:00:00"
}
```

缺少或留空 `raw_text` 返回 `422` 和 FastAPI 验证错误；非法时间同样返回 `422`。
