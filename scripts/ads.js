const ROIIFY_CONFIG = {
  appId: "roiify-web-banner",
  userId: "",
  sdkUrls: [
    "https://roiify.net/sdk/roiify-ads.js",
    "https://www.roiify.net/sdk/roiify-ads.js"
  ],
  placements: {
    banner: "plc_8d53vjsdcj8r",
    interstitial: "animal_match_interstitial",
    rewardedMoves: "animal_match_rewarded_moves",
    rewardedTools: "animal_match_rewarded_tools"
  },
  testMode: false
};

class RoiifyAdsAdapter {
  constructor(config) {
    this.config = config;
    this.sdk = this.findSdk();
    this.mockMode = !this.sdk;
    this.ready = false;
  }

  async init(context = {}) {
    await this.waitForSdk();
    this.config.userId = context.userId || this.config.userId;
    const payload = {
      appId: this.config.appId,
      userId: this.config.userId,
      testMode: this.config.testMode,
      platform: "telegram",
      initData: context.initData || ""
    };

    if (this.sdk?.init) {
      await this.sdk.init(payload);
    } else if (this.sdk?.initialize) {
      await this.sdk.initialize(payload);
    }

    this.ready = true;
    this.track("ads_init", { mockMode: this.mockMode });
    window.dispatchEvent(new CustomEvent("roiify:ready", {
      detail: { mockMode: this.mockMode }
    }));
  }

  findSdk() {
    return window.RoiifyAds || window.Roiify || window.roiify || null;
  }

  async waitForSdk(timeoutMs = 4500) {
    const startedAt = Date.now();
    this.sdk = this.findSdk();
    if (!this.sdk) {
      await this.loadSdk();
    }

    while (!this.sdk && Date.now() - startedAt < timeoutMs) {
      this.sdk = this.findSdk();
      if (this.sdk) break;
      await this.delay(120);
    }
    this.mockMode = !this.sdk;
  }

  async loadSdk() {
    for (const url of this.config.sdkUrls || []) {
      if (this.findSdk()) return true;
      const ok = await this.injectScript(url);
      if (ok && this.findSdk()) return true;
    }
    return false;
  }

  injectScript(url) {
    return new Promise((resolve) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve(false);
        return;
      }

      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async showBanner(container) {
    if (!container) return { completed: false };
    const placementId = this.config.placements.banner;
    const selector = `#${container.id}`;

    if (this.sdk?.showBanner) {
      await this.sdk.showBanner({ placementId, container });
      container.classList.add("ready");
      return { completed: true };
    }

    if (this.sdk?.banner?.show) {
      await this.sdk.banner.show({ placementId, container });
      container.classList.add("ready");
      return { completed: true };
    }

    if (this.sdk?.show) {
      container.textContent = "";
      await this.sdk.show(placementId, selector, {
        theme: "auto",
        width: "auto",
        radius: "8"
      });
      container.classList.add("ready");
      return { completed: true };
    }

    container.classList.add("ready");
    container.textContent = "Roiify Banner Mock";
    return { completed: true, mock: true };
  }

  async refreshBannerForReward(container, reason = "tools") {
    if (!container) return { completed: false };

    this.track("ad_request", {
      type: "banner_reward",
      placementId: this.config.placements.banner,
      reason
    });

    this.resetBannerContainer(container);
    container.dataset.rewardRefresh = String(Date.now());

    try {
      const result = await this.showBanner(container);
      const filled = await this.waitForBannerFill(container);

      if (!filled && !result?.mock) {
        container.classList.add("failed");
        container.innerHTML = "<span>广告暂时不可用</span>";
        this.track("ad_no_fill", {
          type: "banner_reward",
          placementId: this.config.placements.banner,
          reason
        });
        return { completed: false, filled: false };
      }

      this.track("ad_reward_ready", {
        type: "banner_reward",
        placementId: this.config.placements.banner,
        reason,
        mock: !!result?.mock
      });
      return { ...result, completed: true, rewarded: true, filled: true };
    } catch (error) {
      container.classList.add("failed");
      container.innerHTML = "<span>广告加载失败</span>";
      this.track("ad_error", {
        type: "banner_reward",
        placementId: this.config.placements.banner,
        reason,
        message: error?.message || String(error)
      });
      return { completed: false, filled: false, error };
    }
  }

  resetBannerContainer(container) {
    container.classList.remove("ready", "failed");
    [
      "data-roiify-loaded",
      "data-roiify-placement",
      "data-revio-loaded",
      "data-revio-placement",
      "data-zde-loaded",
      "data-zde-placement"
    ].forEach((name) => container.removeAttribute(name));

    container.innerHTML = "<span>广告加载中...</span>";
  }

  async waitForBannerFill(container, timeoutMs = 5000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (this.isBannerFilled(container)) return true;
      await this.delay(160);
    }
    return this.isBannerFilled(container);
  }

  isBannerFilled(container) {
    if (!container) return false;
    if (container.querySelector("iframe, img, canvas, video")) return true;

    const text = container.textContent.trim();
    if (!text) return false;
    return ![
      "Roiify Banner",
      "广告加载中...",
      "广告暂时不可用",
      "广告加载失败"
    ].includes(text);
  }

  async showInterstitial(reason = "level_end") {
    const placementId = this.config.placements.interstitial;
    this.track("ad_request", { type: "interstitial", placementId, reason });

    if (this.sdk?.showInterstitial) {
      return this.normalizeResult(await this.sdk.showInterstitial({ placementId, reason }));
    }

    if (this.sdk?.interstitial?.show) {
      return this.normalizeResult(await this.sdk.interstitial.show({ placementId, reason }));
    }

    await this.delay(450);
    this.track("ad_mock_complete", { type: "interstitial", placementId, reason });
    return { completed: true, mock: true };
  }

  async showRewarded(reason = "extra_moves") {
    const placementId = reason === "tools"
      ? this.config.placements.rewardedTools
      : this.config.placements.rewardedMoves;

    this.track("ad_request", { type: "rewarded", placementId, reason });

    if (this.sdk?.showRewarded) {
      return this.normalizeResult(await this.sdk.showRewarded({ placementId, reason }));
    }

    if (this.sdk?.rewarded?.show) {
      return this.normalizeResult(await this.sdk.rewarded.show({ placementId, reason }));
    }

    await this.delay(700);
    this.track("ad_mock_complete", { type: "rewarded", placementId, reason });
    return { rewarded: true, completed: true, mock: true };
  }

  track(eventName, payload = {}) {
    const eventPayload = {
      ...payload,
      appId: this.config.appId,
      ts: Date.now()
    };

    if (this.sdk?.track) {
      this.sdk.track(eventName, eventPayload);
      return;
    }

    if (this.sdk?.analytics?.track) {
      this.sdk.analytics.track(eventName, eventPayload);
      return;
    }

    console.info("[roiify mock]", eventName, eventPayload);
  }

  normalizeResult(result = {}) {
    return {
      ...result,
      completed: result.completed ?? result.closed ?? result.success ?? true,
      rewarded: result.rewarded ?? result.reward ?? result.completed ?? true
    };
  }

  delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}

window.roiifyAds = new RoiifyAdsAdapter(ROIIFY_CONFIG);
