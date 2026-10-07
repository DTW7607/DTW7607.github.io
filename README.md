# 华容道

支持经典阵型、自定义布阵、后台提示、惯性滑动、连锁推动和持续转向。

在线游玩：

- https://dtw7607.github.io/
- https://dtw7607.github.io/huarongdao/

打开 index.html 即可离线游玩；全部页面、样式与求解线程包含在单文件内。

经典阵型资料的许可说明见 THIRD_PARTY_NOTICES.md。

## 中英文支持

两个入口均在页首提供「中文 / English」按钮，可通过 Tab、Enter 或空格操作。
首次访问按浏览器语言优先顺序选择中文或英文（支持区域变体）；没有匹配语言时显示中文。
手动选择保存到 `localStorage` 的 `huarongdao.language`，刷新及两个入口之间导航后保留。
浏览器禁止存储时仍可即时切换，但无法跨刷新保存偏好。切换不会重置棋局。

## 验证

页面无需构建，也不依赖新增运行时包。开发检查可安装测试依赖后执行：

```sh
npm install --no-save jsdom playwright
node tests/english-support.cjs
npx playwright install chromium
node tests/english-support.browser.cjs
```

也可用 `CHROMIUM_EXECUTABLE` 指定本地 Chromium；`SCREENSHOT_DIR` 指定已存在的截图目录。
具体覆盖范围和验证限制见 [VALIDATION.md](VALIDATION.md)。
