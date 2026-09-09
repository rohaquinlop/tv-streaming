var ChannelManager = {
  channels: [],
  currentIndex: 0,

  init: function (channels, lastChannelId) {
    this.channels = channels;
    this.currentIndex = 0;

    if (lastChannelId) {
      for (var i = 0; i < channels.length; i++) {
        if (channels[i].id === lastChannelId) {
          this.currentIndex = i;
          break;
        }
      }
    }
  },

  current: function () {
    return this.channels[this.currentIndex];
  },

  next: function () {
    this.currentIndex = (this.currentIndex + 1) % this.channels.length;
    return this.current();
  },

  previous: function () {
    this.currentIndex =
      (this.currentIndex - 1 + this.channels.length) % this.channels.length;
    return this.current();
  },

  channelNumber: function () {
    return this.currentIndex + 1;
  }
};
