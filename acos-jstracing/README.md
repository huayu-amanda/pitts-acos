# acos-jstracing

这个仓库里的 `acos-jstracing` 既是 **ACOS 的 content-type 模组**，也可以作为 **standalone npm 项目**单独运行来方便调 UI / 调试 pyodide。

## 开发约定（以旧结构为主）

- UI 源码（你主要改这里）：`lib/jstracing/frontend/`
- 提供给 acos-server 的静态资源：`static/`

acos-server 只会把安装包的 `static/` 映射到 `/static/jstracing`，所以 `static/` 需要存在。
为避免你维护两份文件，本项目会在 `npm run dev/start` 前自动执行同步：

```bash
npm run sync-static
```

把 `lib/jstracing/frontend/jstracing.(js|css)` 同步到 `static/`。

## Standalone 运行（不依赖 docker）

在 `acos-jstracing/` 目录：

```bash
npm install
npm run dev
```

- 默认端口：`3030`（可用环境变量 `PORT` 覆盖）
- 打开：`http://localhost:3030/`
- 练习页 URL 形式与 acos-server 保持一致：
  - `http://localhost:3030/html/jstracing/jstracing-python/point_above_below`

运行后会在 `jstracing-python/` 目录生成/更新：`<exercise>.session.json`（例如 `point_above_below.session.json`）。

## 嵌入 acos-server（作为模组）

acos-server 会把安装的包的 `static/` 映射到：`/static/<package.namespace>`。

本包的前端资源在：
- `static/jstracing.css`
- `static/jstracing.js`

因此嵌入后，页面会从 `/static/jstracing/...` 加载资源。

### 推荐的本地开发切换方式（灵活）

1) **用 npm link 做“热切换”**（最省事）：

```bash
# 在 acos-jstracing/
npm link

# 在 acos-server/
npm link acos-jstracing
```

然后启动 `acos-server`，它会使用你本地的 `acos-jstracing`（改完刷新即可）。

2) **用 file 依赖固定到本地路径**（更可重复）：

在 `acos-server/package.json` 里把依赖写成：

```json
{
  "dependencies": {
    "acos-jstracing": "file:../acos-jstracing"
  }
}
```

再执行：

```bash
npm install
```

备注：本包 standalone 需要的依赖（例如 `express`）放在 `devDependencies`，
因此作为依赖安装进 acos-server 时不会额外拉这些开发依赖；acos-server 只会使用 `lib/` 的模组逻辑。

## URL 兼容性

standalone server 与 acos-server 使用同一套路由：
- 页面：`/html/jstracing/:contentPackage/:name`
- 事件：`POST /html/jstracing/:contentPackage/:name/event`

这样你在 standalone 调通的 UI，嵌入 acos-server 基本不需要改前端代码。
