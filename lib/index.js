var Context = require('./context');
var state = require('./state');

var agi = {
  state: require('./state'),
  Context: require('./context'),
  createServer: function(handler) {
    return require('net').createServer(handler);
  }
};

module.exports = agi;
