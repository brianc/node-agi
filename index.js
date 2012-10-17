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
  var lines = msg.split('\n');
  if(lines.length > 2) {
    lines.pop(); //discard last line
  }
  lines.pop(); //discard blank line
  msg = lines.join('\n');
  var parsed = /^(\d{3})(?: result=)(.*)/.exec(msg);
  this.emit('response', {code: parsed[1], result: parsed[2]});
};

Context.prototype.setState = function(state) {
  this.state = state;
};

Context.prototype.send = function(msg) {
  this.stream.write(msg);
};

Context.prototype.exec = function() {
  var args = Array.prototype.slice.call(arguments, 0);
  this.send('EXEC ' + args.join(' ') + '\n');
}

module.exports = {
  Context: Context,
  state: state
}
