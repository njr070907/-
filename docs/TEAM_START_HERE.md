# 团队成员从这里开始

第一次接触这个项目，请按本页从上到下操作。遇到不懂的 Git 报错，先停下来请团队里熟悉 Git 的成员一起看，不要用强制推送或随意重置来消除报错。

## 1. 项目现在是什么状态

`main` 是全队共同的、当前可运行的演示基线。MVP 已打通“手动粘贴通知 → 规则提取 → 人工确认 → 归入事项 → 版本对比 → 本周待办 → 搜索原文”的流程。通知来源仅限人工粘贴或脱敏演示数据；它用于答辩演示和班级试用，不能替代正式校务系统。

本轮五人分工、统一数据字段、分支名和最终验收，先看 [两天演示版集成契约](INTEGRATION_CONTRACT.md)。开始写功能前必须确认自己的改动范围。

## 2. 第一次把项目取到电脑上

先安装 Git、Python 和 Node.js；版本与安装、启动步骤见 [README](../README.md)。打开 **Windows PowerShell**，在你准备存放项目的文件夹中运行：

```powershell
git clone https://github.com/njr070907/-.git xiaoshiqing
cd xiaoshiqing
git switch main
git pull --ff-only origin main
```

`clone` 是把 GitHub 仓库复制到电脑上，只需第一次做。以后不要反复 clone 同一个工作目录。

## 3. 每项任务都用自己的分支

**不要直接在 `main` 上改文件。** 开始新任务前，先在仓库根目录运行：

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/your-task
```

把 `feature/your-task` 换成这次任务的英文短名。例如 `feature/notice-processing`、`feature/matter-model`、`feature/search`、`feature/ui-home`。数据收集可用 `data/member-a-notices`，修 bug 可用 `fix/short-name`。一个任务用一个分支，不要与别人使用同一个分支名。如果团队已经给你分配了现成分支，先确认分支名，再运行 `git fetch origin` 和 `git switch 分支名`；不要另建同名分支。

## 4. 启动项目

准确命令和环境要求见 [README 的“从全新 clone 启动”](../README.md#从全新-clone-启动)。顺序是：创建 Python 虚拟环境 → 安装 `backend/requirements-dev.txt`（包含运行依赖和测试工具）→ 导入 Seed Data → 启动 FastAPI；另开终端在 `frontend/` 运行 `npm ci` 和 `npm run dev`。

- 页面：`http://localhost:5173`
- 后端：`http://localhost:8000`
- API 交互文档：`http://localhost:8000/docs`

后端和前端要在两个终端分别保持运行。运行时用的是本机 SQLite 数据库；`data/raw` 文件需要先导入才会出现在页面上。

## 5. 如果你的任务是收集通知

原始通知放在 `data/raw/`，**一条通知一个 JSON 文件**。不要把所有人的通知写入同一个文件。

1. 在自己的 `data/*` 分支，复制模板：`Copy-Item data/raw/example_notice.json data/raw/notice_001.json`。给新文件起一个团队内唯一的名字；多人同时收集时，建议在文件名中加入自己的代号。
2. 打开新文件，修改其中的 `id`，确保它与其他通知的 `id` 不同。然后填写 `title`、`source_name`、`source_url`、`published_at`、`collected_by`、`collected_at` 和 `raw_text`。
3. 不知道的值写 JSON 的 `null`，不要编造。`raw_text` 必须保留完整原始通知正文，不要用摘要替代，也不要放入账号、密码或 Token。
4. 不要修改别人的通知文件，除非团队明确是在修正错误。按 README 的导入命令验证自己的文件。

例如数据成员可分别使用 `data/member-a-notices`、`data/member-b-notices`，各自提交 Pull Request。更详细的字段说明见 [data/README.md](../data/README.md)。

## 6. 完成后提交给团队

确认当前仍在**自己的分支**，再运行：

```powershell
git status
git add .
git status
git commit -m "feat: describe your change"
git push -u origin 自己的分支名
```

数据提交可把 commit 信息改为 `data: add notice batch`，文档改为 `docs: update guide`。第二次推送同一分支时可用 `git push`。执行 `git add .` 后，检查 `git status` 中待提交文件，确认没有真实 `.env`、数据库文件或敏感信息。

然后打开 [GitHub 仓库](https://github.com/njr070907/-)，进入 **Pull requests → New pull request**，选择 `base: main`、`compare: 自己的分支`，描述你做了什么和怎样验证，提交 PR 等待审阅。**不要执行 `git push origin main`。** 如果出现冲突，不要盲点 “Accept All”；请熟悉 Git 的成员一起处理。

## 7. 当前边界与尚未完成的功能

- 已有规则提取、人工确认、事项归并、版本对比、本周待办、搜索与原文回看。
- 系统不会自动登录或抓取学校平台，不读取微信群，也不解析附件、PDF 或 Word。
- 结果必须由使用者对照原文确认；系统不会替用户判断哪一版通知更正确，也不会补造原文没有的信息。
- 正式账号体系、自动消息推送、支付、校园级部署和云端多用户协作尚未进入本轮 MVP。

更多协作规则见 [CONTRIBUTING.md](../CONTRIBUTING.md)。
