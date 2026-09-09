var Config = {
  REMOTE_URL: 'https://raw.githubusercontent.com/rohaquinlop/tv-streaming/master/channels.json',
  FETCH_TIMEOUT: 5000,

  FALLBACK_CHANNELS: [
    {
      id: 'caracol',
      name: 'Caracol TV',
      type: 'hls',
      url: 'http://181.78.17.228:8081/CARACOL-HD/index.m3u8'
    },
    {
      id: 'rcn',
      name: 'RCN TV',
      type: 'hls',
      url: 'http://181.78.17.228:8081/RCN-HD/index.m3u8'
    }
  ],

  loadChannels: function (callback) {
    var self = this;

    if (!this.REMOTE_URL) {
      this._loadLocal(callback);
      return;
    }

    var xhr = new XMLHttpRequest();
    var timedOut = false;

    var timer = setTimeout(function () {
      timedOut = true;
      xhr.abort();
      self._loadLocal(callback);
    }, this.FETCH_TIMEOUT);

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || timedOut) return;
      clearTimeout(timer);

      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          if (data.channels && data.channels.length > 0) {
            callback(data.channels);
            return;
          }
        } catch (e) {}
      }
      self._loadLocal(callback);
    };

    xhr.open('GET', this.REMOTE_URL, true);
    xhr.send();
  },

  _loadLocal: function (callback) {
    var self = this;
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          if (data.channels && data.channels.length > 0) {
            callback(data.channels);
            return;
          }
        } catch (e) {}
      }
      callback(self.FALLBACK_CHANNELS);
    };

    xhr.open('GET', 'channels.json', true);
    xhr.send();
  }
};
