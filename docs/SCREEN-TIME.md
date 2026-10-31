# iOS Screen Time 与 Ztime 的差异

调研日期为 2026-10-31。Apple 一侧以 iOS 27 用户手册和开发者文档为依据，Ztime 一侧以 Windows / Android 0.2.3 源码为依据。本次为文档和源码对照，未做两台设备同时计时的精度实验。

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
