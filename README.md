# 轨迹照片九宫格 · trace-photo-overlay

把**任意运动轨迹**（骑行 / 徒步 / 越野跑 / 跑步 / 滑雪…）叠加到九宫格照片上，一键导出朋友圈九图。

**纯前端 · 零后端 · 零上传 · 完全离线。** 单个 HTML 文件即是全部，照片与轨迹永不离开你的设备。

**在线使用**：https://hcazrej.github.io/trace-photo-overlay/ （部署后约几分钟生效）

> GPX/KML/GeoJSON 是通用的轨迹格式——任何记录了 GPS 轨迹的运动都能用，不限于骑行。

## 致谢 / Credits

本项目的创意与功能参考自 <http://43.136.132.103:3000/>（「旅图九格」）。这是一次**干净重写**：保留它真正有价值的部分（轨迹叠层 + 九宫格合成），去掉了不安全 / 没必要的部分。

| | 原站点 | 本项目 |
|---|---|---|
| 部署 | raw IP + HTTP | 任意静态托管，HTTPS |
| 后端 | Express + 多个 API | **无后端** |
| 图片 | 浏览器本地处理 | 浏览器本地处理，**无任何上传逻辑** |
| 埋点 | `/api/track` 上报 | **无** |
| 付费墙 / 水印 | 兑换码 + 预览水印 | **无** |
| 外部请求 | 多个 CDN + 地图瓦片 | **无 · 完全离线**（HEIC 解码库已本地托管） |

## 怎么用

**不需要安装任何东西，不需要 npm / pnpm / 构建步骤。** 它就是一个静态 HTML 页面。

三种打开方式，任选其一：

### 1. 直接打开（最简单）

双击 `index.html`，或在浏览器里打开它即可。

> 个别浏览器在 `file://` 协议下会限制本地动态加载 `heic2any.min.js`（仅影响 HEIC 转换，普通 jpg/png/webp 不受影响）。若 HEIC 没反应，用下面的「本地服务器」方式。

### 2. 起一个本地服务器（推荐）

任选一个你机器上已有的工具，在项目目录下执行：

```bash
# 方式 A：Python（macOS / 多数 Linux 自带，无需安装）
python3 -m http.server 8080

# 方式 B：Node（若已装 node）
npx serve .          # 或 npx http-server -p 8080
```

然后浏览器打开 `http://localhost:8080`。

### 3. 部署到 HTTPS（推荐长期使用）

纯静态，把文件推上去即可，零配置：

- **GitHub Pages**：仓库 → Settings → Pages → Source 选 `main` 分支根目录，保存后访问 `https://<用户名>.github.io/trace-photo-overlay/`。
- **Vercel / Cloudflare Pages**：连接仓库或拖拽文件夹，无需任何构建命令。

## 操作流程

1. **导入运动轨迹**（可选）：拖入 `.gpx / .kml / .geojson / .tcx / .csv`，自动平滑成曲线，可调颜色 / 线宽。
2. **上传 9 张照片**：点格子单张上传，或「批量上传」一次填满，可拖动交换位置。支持 jpg / png / webp / **HEIC** / 实况照片（本地转换）。
3. **文字标注**（可选，Strava 风格）：标题 / 日期 + 可勾选 **距离 / 时长 / 均速 / 配速 / 爬升**，竖排大数字叠加到指定格、附轨迹缩略图。导入轨迹后自动算出并预填，也可手改。骑行勾「距离+时长+均速」，徒步勾「距离+时长+爬升」，跑步勾「距离+时长+配速」。
4. **导出**：9 格填满后下载 `轨迹九宫格.zip`，含 `1.jpg`…`9.jpg`，按 1→9 顺序发朋友圈即拼成九宫格。

`sample-route.gpx` 是一条示例环线，可直接拖进去试。

## 支持的轨迹格式

来自 Strava / Garmin / 行者 / 黑鸟单车 / 两步路 / 佳明 / 高驰等 App 导出的：

- **GPX**：`trkpt` 轨迹点 / `rtept` 路点
- **KML**：`gx:Track` / `LineString` / `Polygon` / `Placemark`
- **GeoJSON**：`LineString` / `MultiLineString`（含 FeatureCollection 嵌套）
- **TCX / 纯文本 CSV**：`lat,lng` 或 `lng,lat`（自动判别顺序）

直接导入你自己的轨迹即可，**无需改代码**。想把常走的路线做成一键预设，见 `index.html` 中 `trackPoints` 的用法注释。

**运动数据从哪来**：距离总能从坐标点算出；**时长 / 均速 / 配速**需要轨迹点带时间戳 `<time>`，**总爬升**需要带海拔 `<ele>`——用手机 / 手表 / Strava 实际记录的轨迹基本都有，纯手画的规划路线则只有坐标（只能得到距离）。算不出的指标会留空，可手填。

> 时长为**运动时长**（已扣除停顿 / 过夜），均速、配速随之计算；总爬升用迟滞阈值去噪（避免 GPS 海拔抖动导致的数倍虚高）。纯 GPS 计算与运动 App 的气压计 / 专有算法会有出入，数值均可手改——以你 App 里显示的为准最稳。

## 技术实现

单 HTML 文件，关键算法已用 Node 单测验证（见 `core.mjs` / `core.test.mjs`，25 个用例）：

- **轨迹解析**：GPX / KML / GeoJSON / CSV，自动判别经纬度顺序。
- **Catmull-Rom 样条**：稀疏轨迹点加密到 ~500 点，消除折线尖角。
- **Web Mercator 投影**：等比映射到正方形画布，5% padding，保持真实形状不拉伸。
- **九宫格合成**：轨迹渲染成 2400×2400 后切 9 块叠到照片，支持「裁切 1:1」与「保持原比例」。
- **运动数据卡**：Strava 风格竖排（标签 + 大数字）+ 轨迹缩略图。距离（Haversine）、时长、均速、配速、总爬升从轨迹的 `time` / `ele` 自动算出，指标可勾选，字号随画布自适应。
- **零依赖 ZIP**：自实现 STORE 模式 ZIP 打包（含 CRC32），不引入 JSZip。
- **离线 HEIC**：`heic2any`（libheif WASM 以 data URI 内联）本地托管于 `heic2any.min.js`，无任何外部网络请求。

## 开发 / 测试

运行核心逻辑测试（仅开发需要，使用工具本身不需要 Node）：

```bash
node --test core.test.mjs
```

## License

[MIT](./LICENSE) © HcaZreJ
