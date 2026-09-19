# 日期不完整场景

## 人工关联

本条通知用于单独验证，不要求与其他通知合并：

- `demo_incomplete_deadline`

建议事项名称：`材料补充事项`

## 预期提取

- matter_name：`[脱敏演示数据] 关于材料补充事项的通知`
- audience：`相关学生`
- stage：`待确认`
- deadline：`null`
- submit_channel：`材料补充平台`
- materials：`补充材料`
- explicit_change：空
- evidence：deadline 应包含原文片段 `9月21日18:00`

## 要证明的行为

原文只有月日、没有年份。系统可以把该片段作为 evidence 展示，但不能自动猜测年份，也不能创建带明确截止时间的本周待办。

## 一句话结论

日期不完整时，系统应提示用户确认，而不是补造年份。
