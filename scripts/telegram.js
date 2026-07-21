(function initTelegramMiniApp() {
  const tg = window.Telegram?.WebApp;
  const playerLabel = document.getElementById("playerLabel");

  if (!tg) {
    playerLabel.textContent = "Web Preview";
    window.telegramGame = {
      adContext: {
        userId: "browser_preview",
        initData: ""
      },
      sendScore() {},
      notify() {}
    };
    return;
  }

  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();

  document.documentElement.style.setProperty("--bg", tg.themeParams.bg_color || "#101820");
  document.documentElement.style.setProperty("--text", tg.themeParams.text_color || "#f7fbf4");

  const user = tg.initDataUnsafe?.user;
  if (user?.first_name) {
    playerLabel.textContent = `Hi, ${user.first_name}`;
  }

  tg.MainButton?.setParams?.({
    text: "重新开始",
    color: "#ffcc4d",
    text_color: "#1f1b10"
  });
  tg.MainButton?.show?.();
  tg.MainButton?.onClick?.(() => {
    window.dispatchEvent(new CustomEvent("animal-match:restart"));
  });

  window.telegramGame = {
    adContext: {
      userId: user?.id ? String(user.id) : "",
      initData: tg.initData || ""
    },
    userId: user?.id ? String(user.id) : "telegram_guest",
    sendScore(score, level, extra = {}) {
      tg.HapticFeedback?.impactOccurred?.("light");
      tg.sendData?.(JSON.stringify({
        type: "animal_match_score",
        score,
        level,
        target: extra.target || 0,
        movesLeft: extra.movesLeft || 0,
        completedAt: Date.now()
      }));
    },
    notify(type = "success") {
      tg.HapticFeedback?.notificationOccurred?.(type);
    }
  };
})();
