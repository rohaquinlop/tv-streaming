var Config = {
  REMOTE_URL: 'https://raw.githubusercontent.com/rohaquinlop/tv-streaming/master/channels.json',
  FETCH_TIMEOUT: 5000,

  FALLBACK_CHANNELS: [
    {
      id: 'caracol',
      name: 'Caracol TV',
      type: 'hls',
      urls: [
        'http://190.61.47.54:8000/play/a01e/index.m3u8',
        'http://181.79.86.130:8000/play/a077/index.m3u8',
        'http://168.228.44.241:9997/play/a03t/index.m3u8',
        'http://200.115.96.61:9090/play/a0jk/index.m3u8'
      ]
    },
    {
      id: 'rcn',
      name: 'RCN TV',
      type: 'hls',
      urls: [
        'http://181.78.17.228:8081/RCN-HD/index.m3u8',
        'http://181.78.14.26:4000/play/a07m/index.m3u8'
      ]
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
