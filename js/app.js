(function () {
  var KEY_UP = 38;
  var KEY_DOWN = 40;
  var KEY_BACK = 461;
  var KEY_CH_UP = 427;
  var KEY_CH_DOWN = 428;

  var OVERLAY_DURATION = 3000;
  var LOAD_TIMEOUT = 15000;
  var FALLBACK_TIMEOUT = 8000;

  var video = document.getElementById('player-video');
  var overlay = document.getElementById('overlay');
  var overlayNumber = overlay.querySelector('.overlay-number');
  var overlayName = overlay.querySelector('.overlay-name');
  var loading = document.getElementById('loading');
  var error = document.getElementById('error');

  var overlayTimer = null;
  var loadTimer = null;
  var backPressedAt = 0;

  var currentChannel = null;
  var currentUrls = [];
  var urlIndex = 0;
  var attemptSrc = '';
  var discoveryTried = false;

  function showOverlay(channel, number) {
    overlayNumber.textContent = 'Canal ' + number;
    overlayName.textContent = channel.name;
    overlay.classList.add('visible');

    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(function () {
      overlay.classList.remove('visible');
    }, OVERLAY_DURATION);
  }

  function showLoading() {
    loading.classList.remove('hidden');
    error.classList.remove('visible');
  }

  function hideLoading() {
    loading.classList.add('hidden');
  }

  function showError() {
    hideLoading();
    error.classList.add('visible');
  }

  function dedupe(items) {
    var seen = {};
    var result = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i] && !seen[items[i]]) {
        seen[items[i]] = true;
        result.push(items[i]);
      }
    }
    return result;
  }

  function channelUrls(channel) {
    var list = [];
    var i;

    // The URL that played last time goes first.
    var learned = Storage.getGoodUrl(channel.id);
    if (learned) {
      list.push(learned);
    }

    if (channel.urls && channel.urls.length > 0) {
      for (i = 0; i < channel.urls.length; i++) {
        list.push(channel.urls[i]);
      }
    } else if (channel.url) {
      list.push(channel.url);
    }

    if (typeof StreamSources !== 'undefined' && StreamSources.urls) {
      var pool = StreamSources.urls[channel.id] || [];
      for (i = 0; i < pool.length; i++) {
        list.push(pool[i]);
      }
    }

    var extras = Storage.getExtraUrls(channel.id);
    for (i = 0; i < extras.length; i++) {
      list.push(extras[i]);
    }

    return dedupe(list);
  }

  function loadChannel(channel) {
    currentChannel = channel;
    currentUrls = channelUrls(channel);
    urlIndex = 0;
    discoveryTried = false;
    startLoad();

    Storage.setLastChannel(channel.id);
  }

  function startLoad() {
    showLoading();
    error.classList.remove('visible');

    attemptSrc = currentUrls[urlIndex];
    if (!attemptSrc) {
      discoverAndRetry();
      return;
    }

    clearTimeout(loadTimer);
    loadTimer = setTimeout(function () {
      handleLoadFailure();
    }, urlIndex === 0 ? LOAD_TIMEOUT : FALLBACK_TIMEOUT);

    video.style.display = 'block';
    video.src = attemptSrc;
    video.load();
    var p = video.play();
    if (p && p.catch) {
      p.catch(function () {});
    }
  }

  function handleLoadFailure() {
    clearTimeout(loadTimer);
    urlIndex++;

    if (urlIndex < currentUrls.length) {
      startLoad();
      return;
    }
    discoverAndRetry();
  }

  // All known URLs failed. Ask the IPTV-org API for new candidate URLs.
  function discoverAndRetry() {
    if (discoveryTried) {
      showError();
      return;
    }
    discoveryTried = true;

    StreamResolver.discover(currentChannel, function (urls) {
      for (var i = 0; i < urls.length; i++) {
        if (currentUrls.indexOf(urls[i]) === -1) {
          currentUrls.push(urls[i]);
        }
      }
      startLoad();
    });
  }

  video.addEventListener('playing', function () {
    clearTimeout(loadTimer);
    hideLoading();
    error.classList.remove('visible');
    if (currentChannel) {
      Storage.setGoodUrl(currentChannel.id, attemptSrc);
    }
    showOverlay(ChannelManager.current(), ChannelManager.channelNumber());
  });

  video.addEventListener('error', function () {
    if (video.getAttribute('src') !== attemptSrc) return;
    handleLoadFailure();
  });

  function switchChannel(direction) {
    var channel =
      direction === 'next'
        ? ChannelManager.next()
        : ChannelManager.previous();

    loadChannel(channel);
    showOverlay(channel, ChannelManager.channelNumber());
  }

  document.addEventListener('keydown', function (e) {
    switch (e.keyCode) {
      case KEY_UP:
      case KEY_CH_UP:
        e.preventDefault();
        switchChannel('next');
        break;

      case KEY_DOWN:
      case KEY_CH_DOWN:
        e.preventDefault();
        switchChannel('previous');
        break;

      case KEY_BACK:
        e.preventDefault();
        var now = Date.now();
        if (
          overlay.classList.contains('visible') &&
          now - backPressedAt < OVERLAY_DURATION
        ) {
          if (window.PalmSystem) {
            window.close();
          }
        } else {
          backPressedAt = now;
          showOverlay(
            ChannelManager.current(),
            ChannelManager.channelNumber()
          );
        }
        break;
    }
  });

  Config.loadChannels(function (channels) {
    var lastId = Storage.getLastChannel();
    ChannelManager.init(channels, lastId);
    loadChannel(ChannelManager.current());
  });
})();
