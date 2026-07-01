# frisbee-tactics-board · 飞盘战术板

一个适合直接部署到 Vercel 的全栈飞盘（Frisbee / Ultimate Frisbee）战术编辑器。使用 Next.js App Router、React、JavaScript、Less 和 PostgreSQL。

## 已实现功能

- 首页展示、搜索、创建和删除战术
- 点击战术进入编辑器
- 在球场中拖拽我方队员、对方队员和飞盘
- 添加、复制、删除战术页面
- 修改页面名称、动画时长、队员编号和战术说明
- 显示前后页面之间的移动虚线
- 多页连续补间播放，形成跑位动画
- 自动保存和手动保存
- PostgreSQL 云端模式与 localStorage 本地演示模式自动降级
- 桌面端优先，同时提供基础移动端适配

## 技术栈

- Next.js 16 App Router
- React 19
- JavaScript
- Less（构建前编译为 `app/generated.css`）
- PostgreSQL + `postgres` 驱动
- Lucide React 图标

## 本地运行

要求 Node.js 20.9 或更高版本。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

没有配置数据库时，应用会自动使用浏览器 localStorage，并生成两套演示战术。因此克隆项目后可以立即体验全部编辑功能。

## 连接 PostgreSQL

复制环境变量文件：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

数据库表会在第一次 API 请求时自动创建。也可以手动初始化：

```bash
npm run db:init
```

核心表结构：

```sql
CREATE TABLE tactics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  frames JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`frames` 使用 JSONB 保存页面和球场元素，方便后续继续增加传盘轨迹、绘图标注、阵型模板等能力。

## 部署到 Vercel

1. 将本目录推送到 GitHub。
2. 在 Vercel 中导入该仓库，Framework Preset 会识别为 Next.js。
3. 不配置数据库也能部署，但数据仅保存在每个用户的浏览器中。
4. 需要云端数据时，在 Vercel Marketplace 创建 PostgreSQL 数据库，并将连接串设置为项目环境变量 `DATABASE_URL`。
5. 重新部署项目。

构建命令已经配置为：

```bash
npm run build
```

Less 会在构建开始时自动编译，不需要额外修改 Vercel 配置。

## 项目结构

```text
app/
  api/tactics/          # 战术 CRUD Route Handlers
  tactics/[id]/         # 动态战术编辑页
  page.js               # 首页
components/
  Dashboard.js          # 战术首页
  TacticEditor.js       # 编辑器状态、页面和播放控制
  FieldCanvas.js        # 球场、拖拽和移动轨迹
lib/
  client-storage.js     # API 优先、本地存储降级
  db.js                 # PostgreSQL 连接和表初始化
styles/
  index.less            # 全部 Less 样式源文件
```

## 下一步建议

- 用户登录与战术所有权
- 可绘制跑位箭头、传盘线和区域标注
- 撤销/重做与快捷键
- 页面拖拽排序
- 播放速度、循环和暂停后继续
- 分享链接、只读演示模式和战术导出
- 球员阵容模板与 7v7 一键布阵
- 多人实时协同编辑
