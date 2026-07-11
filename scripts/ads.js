const ROIIFY_CONFIG = {
  appId: "YOUR_ROIIFY_APP_ID",
  userId: "",
  placements: {
    banner: "animal_match_banner",
    interstitial: "animal_match_interstitial",
    rewardedMoves: "animal_match_rewarded_moves",
    rewardedTools: "animal_match_rewarded_tools"
  },
  testMode: true
};

class RoiifyAdsAdapter {
  constructor(config) {
    this.config = config;
    this.sdk = window.Roiify || window.roiify || window.RoiifyAds || null;
    this.mockMode = !this.sdk;
    this.ready = false;
  }

  async init(context = {}) {
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

  async showBanner(container) {
    if (!container) return { completed: false };
    const placementId = this.config.placements.banner;

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

    container.classList.add("ready");
    container.textContent = "Roiify Banner Mock";
    return { completed: true, mock: true };
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
