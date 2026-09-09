(function () {
  var KEY_UP = 38;
  var KEY_DOWN = 40;
  var KEY_BACK = 461;
  var KEY_CH_UP = 427;
  var KEY_CH_DOWN = 428;

  var OVERLAY_DURATION = 3000;
  var LOAD_TIMEOUT = 15000;

  var video = document.getElementById('player-video');
  var overlay = document.getElementById('overlay');
  var overlayNumber = overlay.querySelector('.overlay-number');
  var overlayName = overlay.querySelector('.overlay-name');
  var loading = document.getElementById('loading');
  var error = document.getElementById('error');

  var overlayTimer = null;
  var loadTimer = null;
  var backPressedAt = 0;

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

  function loadChannel(channel) {
    showLoading();
    error.classList.remove('visible');

    clearTimeout(loadTimer);
    loadTimer = setTimeout(function () {
      showError();
    }, LOAD_TIMEOUT);

    video.style.display = 'block';
    video.src = channel.url;
    video.load();
    var p = video.play();
    if (p && p.catch) {
      p.catch(function () {});
    }

    Storage.setLastChannel(channel.id);
  }

  video.addEventListener('playing', function () {
    clearTimeout(loadTimer);
    hideLoading();
    error.classList.remove('visible');
    showOverlay(ChannelManager.current(), ChannelManager.channelNumber());
  });

  video.addEventListener('error', function () {
    clearTimeout(loadTimer);
    showError();
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
