const ADSGRAM_CONFIG = {
  // Fill these with the Block IDs from https://partner.adsgram.ai.
  rewardedBlockId: "51032",
  interstitialBlockId: "int-51010",
  debug: false
};

class AdsGramAdapter {
  constructor(config) {
    this.config = config;
    this.controllers = {
      rewarded: null,
      interstitial: null
    };
    this.ready = false;
  }

  async init(context = {}) {
    const sdk = window.Adsgram;
    if (!sdk?.init) {
      this.ready = false;
      this.track("ads_init_failed", { reason: "sdk_unavailable" });
      return false;
    }

    this.controllers.rewarded = this.createController(sdk, this.config.rewardedBlockId);
    this.controllers.interstitial = this.createController(sdk, this.config.interstitialBlockId);
    this.ready = Boolean(this.controllers.rewarded || this.controllers.interstitial);
    this.track("ads_init", {
      configured: this.ready,
      hasRewarded: Boolean(this.controllers.rewarded),
      hasInterstitial: Boolean(this.controllers.interstitial),
      userId: context.userId || ""
    });
    window.dispatchEvent(new CustomEvent("adsgram:ready", {
      detail: { configured: this.ready }
    }));
    return this.ready;
  }

  createController(sdk, blockId) {
    const normalizedId = String(blockId || "").trim();
    if (!normalizedId) return null;

    try {
      return sdk.init({
        blockId: normalizedId,
        debug: Boolean(this.config.debug),
        debugConsole: Boolean(this.config.debug)
      });
    } catch (error) {
      this.track("ad_controller_failed", {
        blockId: normalizedId,
        message: this.errorMessage(error)
      });
      return null;
    }
  }

  async showRewarded(reason = "extra_moves") {
    return this.show("rewarded", reason);
  }

  async showInterstitial(reason = "level_complete") {
    return this.show("interstitial", reason);
  }

  supports(type) {
    return Boolean(String(this.config[`${type}BlockId`] || "").trim());
  }

  async show(type, reason) {
    const controller = this.controllers[type];
    const blockId = type === "rewarded"
      ? this.config.rewardedBlockId
      : this.config.interstitialBlockId;

    if (!controller?.show) {
      this.track("ad_unavailable", { type, reason, configured: Boolean(blockId) });
      return {
        completed: false,
        rewarded: false,
        unavailable: true,
        reason: blockId ? "controller_unavailable" : "block_id_missing"
      };
    }

    this.track("ad_request", { type, reason, blockId });
    try {
      const result = await controller.show();
      const rewarded = type === "rewarded";
      this.track("ad_complete", { type, reason, blockId });
      return {
        completed: true,
        rewarded,
        result
      };
    } catch (error) {
      this.track("ad_error", {
        type,
        reason,
        blockId,
        message: this.errorMessage(error)
      });
      return {
        completed: false,
        rewarded: false,
        error
      };
    }
  }

  track(eventName, payload = {}) {
    const detail = { ...payload, ts: Date.now() };
    window.dispatchEvent(new CustomEvent(`animal-match:${eventName}`, { detail }));
    console.info("[animal-match ads]", eventName, detail);
  }

  errorMessage(error) {
    return error?.description || error?.message || String(error || "unknown_error");
  }
}

window.gameAds = new AdsGramAdapter(ADSGRAM_CONFIG);
