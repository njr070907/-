# 演示数据预期结果

本目录记录 `data/raw/` 中脱敏演示通知的预期提取结果和人工关联方式，不参与数据库导入。

六条通知分为四组：

- 奖学金事项：`demo_scholarship_school_v1`、`demo_scholarship_college_v2`
- 活动报名事项：`demo_activity_initial_v1`、`demo_activity_updated_v2`
- 班级材料事项：`demo_class_material_collection`
- 日期不完整场景：`demo_incomplete_deadline`

`deadline_cases.json` 是截止时间提取的格式用例（下午、星期、日期区间、发布日期等），由后端和前端离线版的测试共同读取。

所有文本均为团队编写的脱敏演示数据，不代表真实校方公告。确认页面允许用户修改提取结果后，再手动关联到对应事项。
