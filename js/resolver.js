// Finds new stream URLs at runtime from the IPTV-org API.
// Used when every configured URL of a channel fails.
var StreamResolver = {
  DEFAULT_API: 'https://iptv-org.github.io/api/streams.json',
  DISCOVER_TIMEOUT: 15000,
  MAX_DISCOVERED: 10,

  // discover(channel, callback) calls callback(urls) with new candidate URLs.
  // It calls callback([]) when the API is unreachable or knows no URL.
  discover: function (channel, callback) {
    var self = this;
    var names = this._channelNames(channel.id);

    if (names.length === 0) {
      callback([]);
      return;
    }

    var xhr = new XMLHttpRequest();
    var done = false;

    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      xhr.abort();
      callback([]);
    }, this.DISCOVER_TIMEOUT);

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || done) return;
      done = true;
      clearTimeout(timer);

      if (xhr.status !== 200) {
        callback([]);
        return;
      }

      var urls = [];
      try {
        var entries = JSON.parse(xhr.responseText);
        for (var i = 0; i < entries.length; i++) {
          if (urls.length >= self.MAX_DISCOVERED) break;
          if (
            entries[i] &&
            entries[i].url &&
            names.indexOf(entries[i].channel) !== -1
          ) {
            urls.push(entries[i].url);
          }
        }
      } catch (e) {}

      Storage.addExtraUrls(channel.id, urls);
      callback(urls);
    };

    xhr.open('GET', this._apiUrl(), true);
    xhr.send();
  },

  _apiUrl: function () {
    if (typeof StreamSources !== 'undefined' && StreamSources.api) {
      return StreamSources.api;
    }
    return this.DEFAULT_API;
  },

  _channelNames: function (channelId) {
    if (
      typeof StreamSources !== 'undefined' &&
      StreamSources.apiChannelNames &&
      StreamSources.apiChannelNames[channelId]
    ) {
      return StreamSources.apiChannelNames[channelId];
    }
    return [];
  }
};
