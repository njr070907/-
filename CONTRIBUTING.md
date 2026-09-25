# 团队协作规则

`main` 是当前可运行的稳定基线。所有功能、数据和文档修改都在自己的分支完成，经 Pull Request 审阅后合入 `main`。第一次参与请先看 [团队入门指南](docs/TEAM_START_HERE.md)。

## 分支与提交

开始任务前：`git switch main` → `git pull --ff-only origin main` → `git switch -c 类型/任务短名`。

- `feature/*`：功能；`fix/*`：修 bug；`data/*`：通知数据；`docs/*`：文档。
- Commit 信息建议使用 `feat:`、`fix:`、`docs:`、`data:`、`chore:` 开头，后面写清具体改动。

不要直接在 `main` 开发或推送；不要 force push、随意 reset、删除别人的分支。

## 提交 Pull Request 前

- 确认项目能按 README 运行，相关测试或构建通过。PR 页面上的 CI 检查（后端 pytest、前端构建与测试）必须通过后再合并。
- 检查 `git status`，不要提交真实 `.env`、Secret、数据库文件、`node_modules` 或 Python 虚拟环境。
- 查看自己的改动，避免覆盖其他成员代码；在 PR 中说明改动和验证方法，目标分支选 `main`。
- 如遇 merge conflict，不要盲目选择 “Accept All”；请联系熟悉 Git 的成员一起确认每处差异。
