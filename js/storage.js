var Storage = {
  KEY: 'tv-colombia-last-channel',

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
  }
};
