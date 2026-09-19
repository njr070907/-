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

## PATCH /api/notices/{id}

更新一条尚未确认的通知草稿，供前端“返回修改原文”后复用原通知 ID。请求字段为 `title`、`raw_text`、`source_name` 和 `source_url`，其中 `raw_text` 必须非空。更新会把 `parse_status` 重置为 `raw` 并清除旧的 `extracted_json`，随后需要重新调用提取接口。

```http
PATCH /api/notices/notice_xxx
Content-Type: application/json

{"title":"修改后的标题","raw_text":"修改后的完整正文","source_name":"演示来源","source_url":null}
```

已确认通知不可修改，返回 `409`；未知 ID 返回 `404`。

## 事项、确认与待办

### POST /api/notices/{notice_id}/extract

运行规则提取，把结果保存到 extracted_json，并将通知标为 review_required。原文不会被修改。

### POST /api/notices/{notice_id}/confirm

用户编辑提取结果后确认。请求必须在 matter_id（关联已有事项）和 new_matter_name（新建事项）中二选一；可选传入 task 创建或更新该通知对应的办理环节。

    {
      "extraction": {
        "matter_name": "奖学金材料提交通知",
        "audience": ["大一学生"],
        "stage": "学院初审",
        "deadline": "2026-09-21T18:30",
        "submit_channel": "学生事务系统",
        "materials": ["申请表"],
        "explicit_change": "",
        "confidence": 0.8,
        "evidence": []
      },
      "new_matter_name": "2026 年奖学金材料",
      "task": {
        "stage": "学院初审",
        "deadline": "2026-09-21T18:30",
        "submit_channel": "学生事务系统",
        "materials": ["申请表"]
      }
    }

### POST /api/matters 与 GET /api/matters/{matter_id}

创建事项，或查看该事项下的通知版本和办理环节。

### POST /api/matters/{matter_id}/notices/{notice_id}

将一条通知手动关联到已有事项，不会创建待办。

### GET /api/matters/{matter_id}/compare

查询同一事项下两条已确认通知的字段变化。请求需要 previous_notice_id 和 current_notice_id；两条通知必须均属于该事项，且都有已确认的提取结果。

    GET /api/matters/matter_xxx/compare?previous_notice_id=notice_a&current_notice_id=notice_b

返回示例：

    {
      "previous_notice_id": "notice_a",
      "current_notice_id": "notice_b",
      "changes": [
        {
          "field": "deadline",
          "before": "2026-09-20T18:00",
          "after": "2026-09-21T18:00"
        }
      ],
      "summary": ["截止时间：2026-09-20T18:00 → 2026-09-21T18:00"]
    }

### GET /api/tasks/week?start=2026-09-20

查看从 start 起七天内、已确认且截止时间明确的待办。PATCH /api/tasks/{task_id} 请求 { "completed": true } 可标记完成。
