# 校事清 MVP 基础工程

当前只验证一条链：原始通知 JSON → SQLite → FastAPI → React 浏览器页面。示例通知是演示数据，不是校方真实公告。当前没有 AI 解析、事项、待办、爬虫、登录或正式 UI。

技术栈：React + Vite + TypeScript；FastAPI + SQLAlchemy；SQLite。需要 Python 3.11+、Node.js 20.19+ 或 22.12+、Git。以下命令在仓库根目录执行，Windows PowerShell 示例。

```text
backend/app/       API、数据库配置和 Notice 模型
backend/scripts/   Seed Import
backend/tests/     最小链路测试
frontend/src/      开发验证页面与 API 客户端
data/raw/          一条通知一个 JSON 的演示数据
docs/              API 和架构说明
```

## 从全新 clone 启动

```powershell
git clone https://github.com/njr070907/-.git xiaoshiqing
cd xiaoshiqing
git switch chore/mvp-foundation
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\backend\.venv\Scripts\python.exe -m backend.scripts.import_seed_data
.\backend\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --port 8000
```

另开终端，从仓库根目录启动前端：

```powershell
cd frontend
npm ci
npm run dev
```

浏览器打开 `http://localhost:5173`，应看到 `Connected`、数据库通知数量、演示通知标题；点击标题可查看原始正文。后端 `/health` 在 `http://localhost:8000/health`，API 文档在 `http://localhost:8000/docs`。

macOS/Linux 使用 `python3 -m venv backend/.venv`、`backend/.venv/bin/python`，复制配置文件用 `cp`；其他步骤相同。若机器的 Python 镜像不可用，可在安装命令追加 `-i https://pypi.org/simple`。

## 数据与测试

SQLite 文件默认是 `backend/app.db`，由导入脚本或后端启动自动建表；它已被 Git 忽略。`DATABASE_URL` 在根目录 `.env` 中配置，默认示例为 `sqlite:///./backend/app.db`，以上命令均从仓库根目录运行。前端地址在 `frontend/.env` 的 `VITE_API_BASE_URL` 配置；改动后重启 Vite。两个 `.env` 均不提交。

新增通知：按 [data/README.md](data/README.md) 复制模板到 `data/raw/`，填写唯一 `id` 和完整 `raw_text`，未知信息填 `null`。再次执行导入命令即可；已有 `id` 会安全跳过。当前 Seed 和 POST 创建的通知均标为 `source_type=manual_copy`、`parse_status=raw`。

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8000/api/notices
cd frontend
npm run build
```

具体请求与错误格式见 [docs/API.md](docs/API.md)。架构边界及未来迁移说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。目前建表使用 `create_all`，正式演进数据库结构时需引入迁移工具。
