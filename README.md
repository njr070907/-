# 校事清个性化演示版

团队成员第一次参与开发，请先阅读 [团队入门指南](docs/TEAM_START_HERE.md)。

当前链路：原始通知 JSON → SQLite → FastAPI → React 页面。前端支持本地演示账号、用户画像、规则排序、搜索、通知详情和截止浏览。示例通知均为演示数据，不是校方真实公告。当前没有 AI 解析、爬虫或正式校园身份认证。

技术栈：React + Vite + TypeScript；FastAPI + SQLAlchemy；SQLite。需要 Python 3.11+、Node.js 20.19+ 或 22.12+、Git。以下命令在仓库根目录执行，Windows PowerShell 示例。

```text
backend/app/       API、数据库配置和 Notice 模型
backend/scripts/   Seed Import
backend/tests/     最小链路测试
frontend/src/      页面、API 客户端、Auth/Profile 边界和推荐规则
data/raw/          一条通知一个 JSON 的演示数据
docs/              API 和架构说明
```

## 从全新 clone 启动

```powershell
git clone https://github.com/njr070907/-.git xiaoshiqing
cd xiaoshiqing
git switch main
git pull --ff-only origin main
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

浏览器打开 `http://localhost:5173`。可以注册本地账号并填写画像，也可以使用演示账号：`student@demo.test`、`graduate@demo.test`、`teacher@demo.test`，密码均为 `Demo1234`。三个账号分别展示本科竞赛/奖学金、研究生科研/讲座、教师教务/科研偏好。后端 `/health` 在 `http://localhost:8000/health`，API 文档在 `http://localhost:8000/docs`。

账户与画像保存在当前浏览器的 LocalStorage 中，仅供演示。密码经过带盐 PBKDF2 摘要处理，但浏览器本地存储不能提供生产级认证或服务端授权；请勿使用真实校园统一身份认证密码。清除浏览器站点数据会清除本地账号资料。

资料页按身份联动学院与专业：本科使用普通专业与标明的特色方向，研究生使用独立项目列表，教师无需填写专业和年级。学院与专业配置、学校官方来源及特殊培养单位的处理见 [学院数据说明](docs/ACADEMIC_DATA.md)。在“其他关注关键词”中可添加最多 10 个词；关键词会与固定关注方向共同参与推荐，兴趣分数合计上限 15 分。

macOS/Linux 使用 `python3 -m venv backend/.venv`、`backend/.venv/bin/python`，复制配置文件用 `cp`；其他步骤相同。若机器的 Python 镜像不可用，可在安装命令追加 `-i https://pypi.org/simple`。

## 数据与测试

SQLite 文件默认是 `backend/app.db`，由导入脚本或后端启动自动建表；它已被 Git 忽略。`DATABASE_URL` 在根目录 `.env` 中配置，默认示例为 `sqlite:///./backend/app.db`，以上命令均从仓库根目录运行。前端地址在 `frontend/.env` 的 `VITE_API_BASE_URL` 配置；改动后重启 Vite。两个 `.env` 均不提交。

新增通知：按 [data/README.md](data/README.md) 复制模板到 `data/raw/`，填写唯一 `id` 和完整 `raw_text`，未知信息填 `null`。再次执行导入命令即可；已有 `id` 会安全跳过。导入命令同时加载 `data/demo_notices.json` 中的 15 条演示通知，已有演示通知同样跳过。当前 Seed 和 POST 创建的通知均标为 `source_type=manual_copy`、`parse_status=raw`。

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8000/api/notices
cd frontend
npm run build
npm test
```

具体请求与错误格式见 [docs/API.md](docs/API.md)。架构边界及未来迁移说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。目前建表使用 `create_all`；本轮新增的通知元数据会对既有 SQLite 表执行可重复的补列。正式演进数据库结构时需引入迁移工具。
