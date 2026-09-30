# AdsGram Telegram 动物消消乐

这是一个可直接部署为 Telegram Mini App 的动物主题三消小游戏原型，包含：

- 7x7 动物消消乐棋盘
- 分数、目标、关卡、步数
- 提示、洗牌、新一局
- 炸弹、小锤、广告奖励道具
- 道具栏为紧凑小按钮，减少对棋盘空间的占用
- 道具用完后点击该道具可直接观看激励广告补充
- 点击、消除、爆炸、特殊动物、广告奖励都有轻量 Web Audio 音效
- 4 连生成横/竖向特殊动物
- 5 连生成炸弹动物
- 多组同时消除生成彩虹动物
- 特殊动物可连锁触发行、列、九宫格或同类全消
- Telegram WebApp 初始化、主题色适配、成绩回传
- AdsGram Rewarded / Interstitial 广告适配层
- 未配置 AdsGram Block ID 时不会发放模拟奖励

## 本地预览

直接打开 `index.html` 即可预览。也可以用任意静态服务器托管本目录。

## 接入 AdsGram

1. 在 AdsGram Publisher 后台创建一个 `Rewarded` 广告块和一个 `Interstitial` 广告块。
2. 打开 `scripts/ads.js`，在 `ADSGRAM_CONFIG` 中填写：
   - `rewardedBlockId`：用于“看广告 +道具”和“看广告 +5 步”。
   - `interstitialBlockId`：用于关卡完成后的自然停顿。
3. 测试时可以把 `debug` 改为 `true`；正式上线前必须改回 `false`。
4. `index.html` 已加载 AdsGram 官方 SDK：`https://sad.adsgram.ai/js/sad.min.js`。

## 广告触发点

- 进入游戏：初始化 AdsGram、记录 `game_start`
- 每关开始：`level_start`
- 过关：调用 AdsGram 插屏广告
- 步数耗尽：展示弹窗，可观看激励广告获得 `+5` 步
- 点击“看广告 +道具”，或在炸弹/小锤数量为 `0` 时点击该道具：展示激励广告，奖励 `+1` 炸弹和 `+1` 小锤
- 使用道具、生成特殊动物、洗牌、过关/失败都会发送埋点

只有 AdsGram 的激励广告 Promise 成功完成时才会发放道具或步数；加载失败、无填充或用户提前退出均不发奖励。

## 部署到 Telegram

1. 将本目录部署到 HTTPS 站点。
2. 在 BotFather 中创建或选择 Bot。
3. 使用 `/setmenubutton` 或 Mini App 配置入口，把 Web App URL 设置为部署后的 `index.html` 地址。
4. 在 Telegram 内打开 Bot，点击入口即可运行。

## 文件结构

```text
index.html
styles.css
scripts/
  ads.js
  telegram.js
  game.js
```
