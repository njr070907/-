# 学院与专业配置

配置位于 `frontend/src/sztuAcademicData.ts`，核查时间为 2026-09。页面仅从该文件读取学院、普通本科专业、特色培养方向和研究生项目。配置项有稳定 `id` 与显示名；旧画像仍保留中文 `college` / `major`，读取时补充可识别的 ID。

当前收录 17 个学院、41 个普通本科专业、未来技术学院 5 个特色方向、13 个硕士项目选项。质量和标准学院为“X + 质量和标准”交叉培养模式，不列为独立普通本科专业；马克思主义学院（人文社科学院）、体育与艺术学院也未凭空添加普通本科专业。没有可核实的独立专业时，资料表允许专业留空。

研究生项目来自学校研究生院目录。目录中的正式招生单位主要是“应用技术学院”等联合培养单位；本地配置按相关学院展示项目，供个性化浏览选择，**不是**正式报考学院编码。两个同名项目按中心或实验室区分。未来接正式学籍或招生数据时应替换该展示归类。

参考的学校官方资料：

- [学校学院入口](https://www.sztu.edu.cn/)
- [2026 年普通本科招生计划](https://zs.sztu.edu.cn/info/1011/4926.htm)
- [2026 年发布的本科专业清单](https://english.sztu.edu.cn/INTERNATIONAL_STUDENTS/Degree_Program1/Admission.htm)
- [人工智能学院专业介绍](https://ai.sztu.edu.cn/xyjj/xyjs1.htm)
- [城市交通与物流学院汽车服务工程在读专业信息](https://utl.sztu.edu.cn/info/1014/3442.htm)
- [未来技术学院特色班专业方向](https://futuretechnologyschool.sztu.edu.cn/jy/xctsb.htm)
- [质量和标准学院培养模式](https://qsa.sztu.edu.cn/xygk/sxjy.htm)
- [2026 年硕士招生目录](https://gra.sztu.edu.cn/info/1055/2762.htm)
- [2027 年硕士招生目录，2026-09-16 发布](https://gra.sztu.edu.cn/info/1055/2877.htm)
