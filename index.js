var Readable = require('readable-stream');
var EventEmitter = require('events').EventEmitter;
var state = {
  init: 0,
  waiting: 2
};

var Context = function(stream) {
  EventEmitter.call(this);
  this.stream = new Readable();
  this.stream.wrap(stream);
  this.state = state.init;
  this.msg = "";
  var self = this;
  this.stream.on('readable', function() {
    //always keep the 'leftover' part of the message
    self.msg = self.read();
  });
  this.msg = this.read();
  this.variables = {};
  this.pending = null;
};

require('util').inherits(Context, EventEmitter);

Context.prototype.read = function() {
  var buffer = this.stream.read();
  if(!buffer) return this.msg;
  this.msg += buffer.toString('utf8');
  if(!~this.msg.indexOf('\n\n')) return this.msg; //we don't have whole message
  //TODO if more than one message comes in (unlikely) we need to split
  if(this.state === state.init) {
    this.readVariables(this.msg);
  } else if(this.state === state.waiting) {
    this.readResponse(this.msg);
  }
  return "";
};

Context.prototype.readVariables = function(msg) {
  var lines = msg.split('\n');
  for(var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var split = line.split(':')
    var name = split[0];
    var value = split[1];
    this.variables[name] = (value||'').trim();
  }
  this.emit('variables', this.variables);
  this.setState(state.waiting);
  return "";
};

Context.prototype.readResponse = function(msg) {
  var parsed = /^(\d{3})(?: result=)(.*)/.exec(msg);
  var response = {
    code: parseInt(parsed[1]),
    result: parsed[2]
  };
  if(this.pending) {
    this.pending(null, response);
    this.pending = null;
  }
  this.emit('response', response);
};

Context.prototype.setState = function(state) {
  this.state = state;
};

Context.prototype.send = function(msg, cb) {
  this.pending = cb;
  this.stream.write(msg);
};

Context.prototype.exec = function() {
  var args = Array.prototype.slice.call(arguments, 0);
  var last = args.pop();
  if(typeof last !== 'function') {
    args.push(last);
    last = function() { }
  }
  this.send('EXEC ' + args.join(' ') + '\n', last);
}

module.exports = {
  Context: Context,
  state: state
}
