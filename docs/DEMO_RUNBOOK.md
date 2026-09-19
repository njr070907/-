# 演示环境启动与安全复位手册

这份手册用于答辩前把本地演示环境恢复到固定状态。复位脚本只接受仓库 `backend/` 目录内的 SQLite 文件，不会连接校园网、公文通或其他外部系统。

## 安全边界

- 运行复位前先停止前后端服务，避免 SQLite 文件仍被占用。
- 只有显式传入 `-ResetDemo` 才会删除演示数据库。
- 脚本会在删除前打印数据库绝对路径；路径不在当前仓库 `backend/` 下会立即拒绝。
- 只允许 `.db`、`.sqlite`、`.sqlite3` 文件，同时处理同名 SQLite `-wal`、`-shm` 辅助文件。
- 不要把数据库、`.env`、密码、Cookie 或 Token 提交到 Git。

## 首次安装

以下命令均在仓库根目录运行，需要 Python 3.11+、Node.js 20.19+ 或 22.12+。

```powershell
git switch main
git pull --ff-only origin main

if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }

py -3 -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt

Push-Location frontend
npm ci
Pop-Location
```

默认数据库是仓库内的 `backend/app.db`。如 `.env` 中设置了 `DATABASE_URL`，复位脚本只接受指向本仓库 `backend/` 内文件的 `sqlite:///` 地址。

## 固定演示数据复位

确认终端显示的绝对路径以当前仓库的 `backend` 目录开头，再继续：

```powershell
.\scripts\Reset-Demo.ps1 -ResetDemo
```

脚本会删除本地演示数据库、重新建表并导入 `data/raw/*.json`。成功输出应类似：

```text
演示数据库绝对路径：C:\...\当前仓库\backend\app.db
演示数据目录：C:\...\当前仓库\data\raw（N 个 JSON）
Scanned: N; imported: N; skipped: 0; failed: 0
演示环境复位完成：已从 N 个 JSON 重建数据库。
```

Issue #5 合并后，固定演示数据应为六条；此时上方 `N` 应为 `6`。脚本按目录实际文件自动计数，不需要因数据文件增加而修改。

不带确认参数时只会报错，不会删除：

```powershell
.\scripts\Reset-Demo.ps1
```

## 启动前后端

终端一，在仓库根目录启动后端：

```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --port 8000
```

终端二，在仓库根目录启动前端：

```powershell
Push-Location frontend
npm run dev
```

打开以下地址检查：

- 前端：`http://localhost:5173`
- 后端健康检查：`http://localhost:8000/health`
- API 文档：`http://localhost:8000/docs`

快速验证命令：

```powershell
Invoke-RestMethod http://localhost:8000/health
$notices = Invoke-RestMethod http://localhost:8000/api/notices
"已导入通知：$($notices.Count) 条"
```

## 复位脚本自检

开发者改动脚本后运行：

```powershell
.\scripts\Test-Reset-Demo.ps1 `
  -PythonPath .\backend\.venv\Scripts\python.exe
```

该检查使用独立测试数据库，不会复位 `backend/app.db`。它验证：

1. 缺少 `-ResetDemo` 时文件保持不变。
2. `backend/` 外的数据库路径被拒绝。
3. 连续两次复位都完整导入相同数量的数据。

## 现场操作清单

### 开场前 15 分钟

- [ ] 拉取已确认的演示版本，不在现场临时合并代码。
- [ ] 关闭旧的前后端进程。
- [ ] 执行 `Reset-Demo.ps1 -ResetDemo`，确认绝对路径和导入数量。
- [ ] 分别启动后端和前端，检查 `/health` 返回 `status: ok`。
- [ ] 确认通知数量与 `data/raw` JSON 数量一致。
- [ ] 在 1440px 和 390px 各走一次添加、确认、版本对比、待办、搜索流程。

### 开始前 5 分钟

- [ ] 浏览器停在“添加通知”页面，关闭无关标签页和系统通知。
- [ ] 准备要粘贴的两条演示通知，不使用真实个人信息。
- [ ] 确认版本对比、本周待办和原文搜索页面能打开。
- [ ] 保留两个服务终端，方便看到错误并快速重启。

### 故障时三步恢复

1. 在两个服务终端按 `Ctrl+C` 停止前后端。
2. 在仓库根目录重新执行 `.\scripts\Reset-Demo.ps1 -ResetDemo`。
3. 按“启动前后端”重新启动两个服务；若仍失败，改用已录制的本地演示视频并记录错误。

## 交付验收记录

| 检查项 | 结果 | 记录人 |
| --- | --- | --- |
| 连续复位两次结果一致 | 自动化检查通过后填写 |  |
| Issue #5 六条数据全部导入 | #5 合并后填写 |  |
| 前后端均可启动 | 实机检查后填写 |  |
| 未参与脚本编写的成员独立复位 | 由队友填写 |  |
