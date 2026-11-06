# Ztime 桌面版改进说明

**三轮改造主要减少重复计算、把不同功能分开、让设计稿与程序更容易保持一致。改动已随 Windows 0.2.44 交付。**

1. **第一轮，让软件少做重复工作。** 以前，刷新时可能重复查询和重画同一张图，行为页的数字样式也要在两处修改。现在，数据和显示时间相同时可以保留原图，数字样式从一处同步。切入环台时，再读取它需要的详细记录。

2. **第二轮，让后台刷新更轻。** 以前，即使停在设置页，每五秒刷新也会计算今日和本周用时。现在，常规刷新只查看状态，统计页根据需要更新图表。检查确认，统计、设备和设置页的常规刷新都不会计算完整的日周汇总。

3. **第三轮，让以后改功能更容易。** 以前，日历、布局弹窗和图卡显示写在一起。现在，各自有独立的代码文件。以后改日历，可以直接找到日历代码；隐藏的图卡也不用再生成。布局保存失败时，已选的内容会保留，方便重试。

**对使用者的变化**

减少无意义的刷新和计算。加载环台失败时，原来的图表仍能使用；保存布局失败时，可以保留选择继续操作。

**对后续开发的变化**

改一个功能时，更容易找到它对应的代码，减少同时查看和修改其他功能的需要。

**交付时做过的检查**

37 项自动化测试通过，桌面操作、报表导出和设计稿对照检查通过。升级前做了备份，升级后核验了原有 19,784 条记录、配对和分类。这些是 0.2.44 交付时的结果。

目前软件仍会每五秒查看状态，有新记录时仍需计算所选日期的用时。

[查看改造前的简单说明](ARCHITECTURE-BEFORE.md)

<details>
<summary>开发者查阅 · 文件位置、数据约定和检查命令</summary>

与[重构前快照](ARCHITECTURE-BEFORE.md)使用相同章节。本文跟随源码维护。如果修改了模块归属、数据单位或兼容约定，请在同一提交更新对应小节。

## 平台与入口

- **Windows**　`desktop/main.cjs` 启动桌面程序，`desktop/server.js` 提供本机 HTTP 路由。新桌面前端资源须加入 `desktop/ui-files.js` 的白名单。采集在 `desktop/collector.js`，账本读写在 `desktop/store.js`，设备同步在 `desktop/protocol.js`。
- **Android**　原生入口在 `android/app/src/main/java/org/timeledger/app/MainActivity.java`。WebView 通过 `web/app.js` 的桥接请求取得原生数据。Android 复制整个 `web/` 和 `shared/` 作为资源，平台交付步骤见 [Android 交接](ANDROID-HANDOFF.md)。
- **摘要**　两端各自取得会话、日期和周边界，共同调用 `shared/summary.js` 的 `summaryStats(sessions, devices, day, week, now)`。同一应用仅在上周出现时，本周用时为零。上周对齐到相同星期和当地时间。日期边界、时区与基础聚合放在 `shared/time.js`。

## 统计页与刷新

`web/app.js` 装配 `createPeriodView`，注入 `readPeriod(snapshot, query)` 和 `saveLayout(cards)`。日期、设备筛选、图表选择、对比区间和指针由 `web/period-view.js` 持有。`web/period-data.js` 把同一个区间请求交给 Windows HTTP 或 Android 本地聚合。

页面首次进入通过 `mount(element, data)` 建立视图。Windows 统计、设置、设备和行为页只轮询 `GET /api/status`，读取设备、采集、配置和账本序号。完整 `/api/summary` 用于需要日周聚合的页面或周报。设备页只在显示字段变化时重绘。桌面后台状态通过 `refresh(data, force)` 通知现有页面。判断分两步：

1. 选区由统计周期、起止日、对比期、设备范围、统计设置和明细类型决定。查询进行期间，旧图可见，过期应答不能覆盖新选区。
2. 同一选区比较账本序号与设备的平台信息。涉及今天时还比较显示分钟，支持暂停采集后时钟继续前进。相同快照跳过查询和重绘。手动更新可重读，拖动中的环台保留当前节点。

**常见改动**　修改指针、双环和回溯刻度，先找 `web/desktop-insights.js` 的 `mountRingDesk` 与同名 CSS。修改自动刷新、切图或失败回退，先找 `web/period-view.js` 的 `update`。修改报表预览或导出，从 `web/reports/period.js` 和 `shared/report-*.js` 进入。

**第三轮改动入口**　`web/period-calendar.js` 管理日期区间、跨月导航、上一年同期和日历内容。`web/period-dialog.js` 持有弹窗焦点、选区草稿与布局保存状态，成功后通过回调提交。`web/period-cards.js` 按布局顺序生成可见图卡，环台展开时跳过应用排行的格式化。报表复用同一份图表序列转换。页面仍负责指针与选中点的联动。

## 会话查询与明细

Windows 的时段数据路径为 `web/period-data.js` → `GET /api/period` → `desktop/period.js` → `Store.sessionsInRange` → `shared/period.js`。SQLite 负责取相交的原始记录，纯函数负责裁剪、分桶、平台筛选和排序。

- `from`、`to` 是含首尾的统计日期。数据库和聚合边界用 Unix 毫秒，区间左闭右开。环台的 `sessions[].start/end` 是距统计日开始的分钟数。`dayMinutes` 从真实日界线计算，能表示夏令时切换日。
- `detail=chart` 包含分桶应用排行，供折线、柱状和点选详情使用。`ring` 在单日额外包含会话轨道。`totals` 供对比期使用，保留期间汇总、分桶时长和总体排行。旧 HTTP 客户端省略 `detail` 时仍取得原响应。纯函数最后一个参数也接受旧的布尔值。
- `GET /api/sessions` 的最近记录使用 `Store.recentSessions`，先按设备、应用、未删除过滤，再按起点倒序取 500 条。指定起止时间的应用详情通过 `sessionsInRange(start, end, {deviceId, appId})` 读取所有相交项。同步仍需删除标记，与页面查询分开。

**常见改动**　新增图卡时优先使用已有时段结果。只有图卡需要新的数据粒度时，才扩展 `desktop/period.js` 和 `shared/period.js` 的契约。修改会话条数限制或 SQLite 条件，从 `desktop/store.js` 入手。

## 设计稿与正式版

- 桌面行为页的汇总数字、排行数字、轨道与相关控件共用 `web/desktop-behavior.css`。行为内容与事件在 `web/behavior-view.js`，图表与时间线分别在 `behavior-chart.js` 和 `behavior-timeline.js`。分类和分桶规则在 `shared/behavior.js`。
- 改完共享的桌面控件或行为样式后，在仓库根目录运行 `node scripts/build-review-insights.mjs`。生成器将行为样式放到评审页原有的沙漏方案作用域，保留其他方案和批注锚点。评审页的 `@generated` 区块可以跳过阅读。
- 全局桌面框边距仍从 `web/hourglass.css` 定位，页面专属布局优先在所属功能样式中查找。

## 维护与验证

- **查询或统计规则**　运行 `node --test tests/*.test.js`。明细粒度、旧响应兼容、区间相交和最近记录上限集中在 `tests/period-queries.test.js`。
- **桌面统计交互**　运行 `node scripts/verify-dashboard-ui.mjs`。该检查覆盖摘要轮询命中、账本变化、环台首次加载失败、快速切换选区、布局与拖动节点复用。
- **设计稿同步**　运行 `node scripts/build-review-insights.mjs --check`。需要核对渲染时，运行 `node scripts/verify-release-parity.mjs`，它也会执行桌面统计交互检查。行为页与报表另有 `verify-behavior-ui.mjs` 和 `verify-report-ui.mjs`，均在 `scripts/`。

**仍有成本的边界**　账本序号变化时，Windows 统计页会重算选中区间。窗口可见时仍按五秒读取元数据。Android 摘要的数据量和原生桥审查由安卓开发会话负责。


</details>
