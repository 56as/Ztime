# iOS Screen Time 与 Ztime 的差异

调研日期为 2026-10-31。Apple 一侧以 iOS 27 用户手册和开发者文档为依据，Ztime 一侧以 Windows / Android 0.2.3 源码为依据。本次为文档和源码对照，未做两台设备同时计时的精度实验。

## 2026-11-01 追加调研：为什么用户会再打开周报

本轮聚焦 Apple 系统内置 Screen Time 的个人使用场景。依据为 Apple 用户手册和已发表的用户研究，尚未访谈 Ztime 的目标用户。

### 从报告入口到下一步行动

1. **想起来看。** Apple 将日均摘要放在设置里，也提供主屏幕小组件和可直接进入摘要的周报通知。用户可以先扫一眼，再决定是否深入。对 Ztime，可以先用现有“每周”页面检验一行摘要有没有价值，之后再判断用户是否愿意接收通知。[Apple 个人设置与周报入口](https://support.apple.com/zh-cn/guide/iphone/iphbfa595995/27/ios/27)
2. **理解变化。** Apple 让用户在日、周和历史区间之间切换，继续查看常用应用、拿起次数和通知次数。时长和次数回答的是两个问题：一次连续阅读和许多次短暂查看，累计时长可能相同。Ztime 已有应用时段与上周同期对比，可以先解释哪个设备、哪个应用贡献了变化。窗口切换次数不能直接当成拿起次数或注意力中断。[Apple 使用摘要](https://support.apple.com/zh-cn/guide/iphone/iphbfa595995/27/ios/27)
3. **决定下一步。** Apple 支持按类别调整时间额度，并区分工作日、周末和不同时间窗口。Ztime 面向个人复盘时，另一种可能的下一步是点开贡献最大的时段，核对这段增加是否符合用户本来的安排。两种任务对应不同的成功标准。[Apple 时间安排与额度](https://support.apple.com/zh-cn/guide/iphone/iphb0c7313c9/27/ios/27)

### 哪些需求已有证据

Zimmermann 在 2021 年发表的研究中，用 242 人的纵向实地研究观察到，追踪用量改善了对使用情况的认识，但较少带来实际用量下降。另一个 139 人的在线实验中，参与者更偏好信息反馈，即使他们认为限制手段更能减少用量。这支持把“看懂自己的时间”和“减少使用”作为两种需求分别验证。研究对象与 Ztime 的 Windows / Android 用户不同，没有验证本项目的留存或付费意愿。[原始研究与样本说明](https://www.journals.uchicago.edu/doi/10.1086/714365)

### 对 Ztime 的定位假设与验证

**最先验证的任务：周末打开手机，解释本周电脑和手机的用量变化。** 示例提问为“电脑比上周多用了 90 分钟，这主要发生在哪几天、哪些应用？手机数据更新到什么时候？”这能利用已有的时段和同期对比，无需先取得网址或通知权限。Apple 已提供自家设备的合并报告；Ztime 的具体适用场景是 Windows 与 Android、本地账本和局域网同步。0.2.3 由手机主动同步，任一端都能一键发起是设计目标。[Apple 跨设备共享](https://support.apple.com/zh-cn/guide/iphone/iphbfa595995/27/ios/27) · [Ztime 同步现状与目标](PRODUCT-DEVELOPMENT.md)

**小样本验证方案。** 找 5 位经常在 Windows 和 Android 之间切换的人，先请他们用现有方法复盘最近一周，然后交替展示两版使用同一组示例数据的周报：一版按应用排行，另一版先突出变化最大的来源、最近同步时间和明细入口。记录能否独立找到来源、解释时间范围，以及是否误把尚未同步的手机记录当成零。第二周再问他们是否主动回来查看、想核对哪一项。若用户能解释数字却没有再次查看的动机，优先重查复盘场景；若他们持续追问具体课程用时，再验证自定义分类是否值得维护。此为后续研究方案，本轮没有执行用户实验。

## Windows 与 Android 上的直接替代品（2026-11-01）

**个人使用先看 StayFree。** 有 Windows 桌面客户端和 Android 应用。开发者说明无需创建账号即可连接设备、查看合计用量并同步限额规则；其浏览器扩展指南展示了六位数配对码的操作。产品提供每日限额和定时屏蔽。本轮没有验证其同步是否能完全在断网的局域网内完成，也没有验证同一服务的安卓 App 和桌面网页版是否实时扣减同一份分钟额度。[开发者的 Android 产品说明](https://play.google.com/store/apps/details?id=com.burockgames.timeclocker) · [设备连接指南](https://userguide.stayfreeapps.com/settings/manage-devices) · [Windows 版与控制功能](https://stayfreeapps.com/)

**家庭管理可看 Microsoft Family Safety。** 家庭组织者可以查看关联设备的应用用量，为 Windows 和 Android 上的应用或游戏设每日时长和允许时段。微软说明网页不能直接使用同一种时间限额。这款产品适合用来比较家庭授权、报告和管控流程。[活动报告](https://support.microsoft.com/zh-cn/family-safety/view-device-and-app-use-with-family-safety-activity-reporting) · [应用与游戏限制](https://support.microsoft.com/zh-cn/family-safety/set-app-and-game-limits)

**竞品实测题。** 两台设备首次连接要经过几步？关掉路由器的互联网出口、保留局域网后，两端新增记录还能否同步？给同一视频服务设 10 分钟限额，在手机 App 用 6 分钟、再在电脑网页版用 4 分钟，哪个端会提示或阻止继续使用？分别记录汇总展示、规则传播和额度执行的结果。当前结论来自官方资料，以上测试尚未执行。

### StayFree 的取舍与 Ztime 的机会

- **功能覆盖。** StayFree 已提供跨设备统计、网页识别、CSV 导出、提醒、应用屏蔽与定时限制。Ztime 0.2.3 目前提供应用记录和复盘，网页识别、行为分类尚在提案阶段，应用限制尚未实现。免账号连接、CSV 导出和多设备统计已经有直接竞品。[StayFree 开发者说明](https://play.google.com/store/apps/details?id=com.burockgames.timeclocker)
- **权限成本。** StayFree 的 Android 说明指出，无障碍服务用于识别及屏蔽网站，并提高限额的可靠性。Ztime 当前按应用采集，仅需使用情况访问，扫码另需相机权限。这个差异适合关心授权范围的用户，但也对应功能覆盖的差别。[StayFree 权限说明](https://play.google.com/store/apps/details?id=com.burockgames.timeclocker)
- **数据处理方式。** StayFree 链接到 Sensor Tower 的多产品共用隐私政策。政策说明上传所列数据会请求明确同意，并列出匿名信息用于商业产品、研究等用途。具体安装收集哪些内容需结合所启用的功能和授权核验。Ztime 当前没有遥测或云端账本，源码公开，数据库和导出由用户保管；本机数据库未额外加密。[Sensor Tower 当前政策](https://sensortower.com/panel-privacy) · [Ztime 隐私说明](../README.md)
- **可靠性信号。** Google Play 页面的一条 2026-02-17 评论认可跨平台统计，但反馈屏蔽偶尔未执行，开发者回复请求设备信息。可把这类反馈转成限额执行和后台恢复的测试场景，不能以个别旧版本评论推断所有设备或当前版本的故障率。Ztime 自身的真实双端同步和 Android 后台行为也仍需实测。[商店评论及开发者回应](https://play.google.com/store/apps/details?hl=en&id=com.burockgames.timeclocker)

对 Ztime 更明确的定位假设是面向希望自己保管数据的 Windows 与 Android 用户，提供可解释的本地应用时间账本。核心验证是断开互联网后的局域网同步、数据更新到何时的展示、以及从周报数字追溯到原始时段。任一端一键同步和按学习目的分类仍需完成设计、架构与验收，方可作为已交付能力宣传。

### 开源状态核查与设计参考（2026-11-01）

**StayFree 按闭源产品对标。** 本次没有找到完整产品源码或开源许可。其公开的 `stayfree-app/desktop-releases` 仓库明确说明用于发布 macOS、Windows 和 Linux 安装包，当前主分支仅有 README；有公开 GitHub 仓库不等于产品开源。适用于 StayFree 的 Sensor Tower 服务条款授予有限使用权，并保留软件权利。这一结论针对完整产品，不代表其所有依赖或个别组件都没有开源。[StayFree 官方发布仓库](https://github.com/stayfree-app/desktop-releases) · [适用服务条款](https://sensortower.com/panel-terms)

**Ztime 的可核验差异。** Ztime 已公开源码并采用 MIT 许可，允许在遵守许可的前提下查看、修改和分发代码。结合当前本地账本、局域网同步与导出，定位可表述为“Windows 与 Android 的开源本地时间账本”。开源便于外部检查，不自动证明安全，也不能单凭这一点推断 StayFree 的具体数据上传行为。任一端一键同步仍是待实施目标。[Ztime 许可](../LICENSE) · [实现现状与设计目标](PRODUCT-DEVELOPMENT.md)

**Apple Screen Time 作为 UI / UX 参考。** 用户已确认这一参考方向。下一轮设计稿可围绕“摘要 → 日 / 周趋势 → 应用排行 → 使用明细”组织页面，统一时间范围、数字单位与颜色含义，减少首屏信息负担；这是 Ztime 的设计建议。本项目还需突出设备筛选、最近同步时间，以及未同步与零使用的区别。先在可批注、可点击的设计稿中确认视觉与交互，再进入架构和实现。[Apple 使用摘要](https://support.apple.com/zh-cn/guide/iphone/iphbfa595995/27/ios/27)

## 一次晚自习，两套工具各能回答什么

晚上在 Windows 浏览器看了 30 分钟课程，其中 10 分钟同时在 Android 手机上翻词典。Ztime 可以把电脑的 30 分钟和手机的 10 分钟放进同一份日报，设备累计 40 分钟。它知道前台应用是浏览器或词典，看不到课程网址，也无法从这两条记录判断实际专注了多久。[计时与汇总代码](../shared/time.js)

换成 iPhone 和 Mac，开启同一 Apple 账户下的跨设备共享后，Screen Time 可以展示合并报告。用户能查看 App 和网站时长、拿起设备和收到通知的次数，还能为晚上设定可用时段。Apple 的用户手册没有在此说明两台设备同时使用时的分钟去重算法，不能据此预测它也会显示 40 分钟。[Apple 使用摘要与跨设备共享](https://support.apple.com/zh-cn/guide/iphone/iphbfa595995/27/ios/27) · [Apple 时间安排与时间额度](https://support.apple.com/zh-cn/guide/iphone/iphb0c7313c9/27/ios/27)

## 影响使用选择的差异

- **看哪些设备。** Screen Time 的个人共享报告覆盖同一 Apple 账户下的 iPhone、iPad 和 Mac。Ztime 面向 Windows 与 Android，两端各自离线记录，待局域网互通后配对、同步，用户可按设备查看。离线手机当天的数据可能尚未出现在电脑上。[Apple 跨设备共享](https://support.apple.com/zh-cn/guide/iphone/iphbfa595995/27/ios/27) · [Ztime 使用说明](../README.md)
- **看哪些细节。** 两者都有日、周视图和应用排行。Apple 另提供网站活动、拿起次数和通知次数。Ztime 保有可导出的应用起止时段，能自定统计日界线、时区和仪表盘布局。例如凌晨两点仍在写论文，在默认 04:00 日界线下，这段时间归入前一统计日。[Apple 摘要](https://support.apple.com/zh-cn/guide/iphone/iphbfa595995/27/ios/27) · [Ztime 聚合规则](../shared/time.js)
- **能否干预。** Apple 能按类别设定时间额度，安排上课、吃饭或睡觉时可使用的 App，家长也能通过家人共享管理孩子设备。Ztime 的暂停开关只控制自身记录；用户仍能使用原应用。目前没有家长端、应用封锁或额度控制。[Apple 时间额度](https://support.apple.com/zh-cn/guide/iphone/iphb0c7313c9/27/ios/27) · [Apple 家庭管理](https://support.apple.com/zh-cn/108806)
- **“分类”用来回答什么。** Apple 已支持查看类别及其 App 的日均使用情况，并对类别设置额度。Ztime 正在讨论的问题更具体，例如把电脑的课程页面与手机的词典合计为“学习”，允许用户改正某一段误归类的记录。目前打开 Ztime 只能看到应用统计。这份调研没有证实 Apple 支持与该提案相同的逐段修正和路径匹配工作流。[Apple 类别设置](https://support.apple.com/zh-cn/guide/iphone/iphb0c7313c9/27/ios/27)
- **如何保管数据。** Ztime 双端保存 SQLite，经 TLS 局域网同步，可导出 JSON / CSV；本地数据库当前没有额外加密。Apple 对家长与孩子设备间传输的使用数据和配置采用端对端加密。两种模式的实际差异在于参与设备、账号关系和用户能拿到的数据形式，不能仅凭“本地”判断哪一方更安全。[Apple 平台安全](https://support.apple.com/zh-cn/guide/security/secd8831e732/web) · [Ztime 隐私说明](../README.md)

## 如果将来开发 iOS 版

1. **在 iPhone 上显示报告。** Family Controls 支持个人授权，用户可撤销。常规授权通过不透明标识表示应用与网站。Device Activity 报告扩展可绘制自定义报告，但沙箱限制网络访问和敏感数据移出扩展。能画出一张本机图表，不能据此认定 Ztime 主程序可以把明细同步给 Windows。[Apple 个人授权与标识](https://developer.apple.com/videos/play/wwdc2022/110336/) · [报告扩展沙箱](https://developer.apple.com/documentation/deviceactivity/deviceactivityreport)
2. **跨平台导出有单独接口和条件。** Apple 为设备活动提供导出方法。面向用户的安装必须同时满足设备位于欧盟、Apple 账户地区属于欧盟、应用具备相应 entitlement，并取得用户明确的数据访问授权。开发设备可以在其他地区测试。即使具备条件，返回数据也按指定时间区间分段；按小时累计的 20 分钟不足以还原每次启动和结束的时间点。[Apple 导出方法及地区条件](https://developer.apple.com/documentation/deviceactivity/deviceactivitydata/activitydata%28filteredby%3Ausing%3A%29) · [返回的数据结构](https://developer.apple.com/documentation/deviceactivity/deviceactivitydata) · [授权状态](https://developer.apple.com/documentation/familycontrols/authorizationstatus/approvedwithdataaccess)
3. **发行前需要独立验证。** 使用 Family Controls 分发时，开发者账号持有人需向 Apple 申请，相关扩展也要提交申请。如果以后立项，应分别验证目标地区正式安装的授权、本机报告、数据粒度和撤销后的行为，再决定哪些指标可以进入跨端总量。[Apple 发行授权流程](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement)

**对 Ztime 的产品判断。** Windows 与 Android 用户今天就能用一份可导出的账本复盘两类设备。行为分类值得验证的是用户能否回答“这周花了多久学一门课”，并追溯每一分钟归到学习的原因。iOS 接入是独立的可行性问题。本次没有将两项提案纳入已交付功能。
