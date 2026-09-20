# 通知处理模块交接说明

4 号模块位于 backend/app/services/notice_processing.py，不访问数据库、不启动接口，也不调用真实大模型。这样 3 号可以单独完成 Matter、Task 和 API；2 号可以在接口完成后直接展示结果。

## 提取一条手动粘贴的通知

    from backend.app.services.notice_processing import extract_notice_fields

    result = extract_notice_fields(raw_text)
    payload = result.model_dump()

payload 固定包含：

    {
      "matter_name": "",
      "audience": [],
      "stage": "",
      "deadline": null,
      "submit_channel": "",
      "materials": [],
      "explicit_change": "",
      "confidence": 0.0,
      "evidence": []
    }

- evidence 是 { "field": "字段名", "text": "原文片段" } 的数组，页面应允许用户回看。
- confidence 是本轮规则已找到的字段比例，不是“通知真实性”或模型概率，不能代替人工确认。
- 日期只有明确年份时才会写入 deadline，格式为 YYYY-MM-DD 或 YYYY-MM-DDTHH:MM。只有“9 月 21 日”时，deadline 保持 null，但原文日期仍会出现在 evidence。
- 未匹配到的字符串字段为空字符串，列表字段为空数组。页面必须允许用户编辑后确认。

## 对比两版已确认通知

    from backend.app.services.notice_processing import compare_notice_versions

    comparison = compare_notice_versions(previous_extraction, current_extraction)

返回的 changes 只比较 deadline、audience、submit_channel、materials；summary 是程序按字段直接生成的中文说明。它不判断哪一版“更正确”，也不会让班级、学院、学校等不同办理环节互相覆盖。

## 3 号接入约定

1. 新通知先以 parse_status=review_required 保存提取结果。
2. 用户修改并点击确认后，才将其标记为 confirmed。
3. 事项关联由用户手动选择或新建；本模块不根据标题自动写入 matter_id。
4. 本周待办只读取时间明确且已确认的 Task。
