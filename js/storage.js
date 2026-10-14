var Storage = {
  KEY: 'tv-colombia-last-channel',
  GOOD_URL_PREFIX: 'tv-colombia-good-url:',
  EXTRA_URLS_PREFIX: 'tv-colombia-extra-urls:',
  MAX_EXTRA_URLS: 10,

  getLastChannel: function () {
    try {
      return localStorage.getItem(this.KEY);
    } catch (e) {
      return null;
    }
  },

  setLastChannel: function (channelId) {
    try {
      localStorage.setItem(this.KEY, channelId);
    } catch (e) {}
  },

  getGoodUrl: function (channelId) {
    try {
      return localStorage.getItem(this.GOOD_URL_PREFIX + channelId);
    } catch (e) {
      return null;
    }
  },

  setGoodUrl: function (channelId, url) {
    try {
      localStorage.setItem(this.GOOD_URL_PREFIX + channelId, url);
    } catch (e) {}
  },

  getExtraUrls: function (channelId) {
    try {
      var raw = localStorage.getItem(this.EXTRA_URLS_PREFIX + channelId);
      var list = raw ? JSON.parse(raw) : [];
      return list instanceof Array ? list : [];
    } catch (e) {
      return [];
    }
  },

  addExtraUrls: function (channelId, urls) {
    try {
      var merged = this.getExtraUrls(channelId);
      for (var i = 0; i < urls.length; i++) {
        if (merged.indexOf(urls[i]) === -1) {
          merged.push(urls[i]);
        }
      }
      merged = merged.slice(0, this.MAX_EXTRA_URLS);
      localStorage.setItem(this.EXTRA_URLS_PREFIX + channelId, JSON.stringify(merged));
    } catch (e) {}
  }
};
