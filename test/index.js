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

var MemoryStream = require('memstream').MemoryStream;
var expect = require('expect.js');

//helpers
var writeVars = function(stream) {
  stream.write('agi_network: yes\n');
  stream.write('agi_uniqueid: 13507138.14\n');
  stream.write('agi_arg_1: test\n');
  stream.write('\n\n');
}
var context = function(cb) {
  var stream = new MemoryStream();
  var ctx = new Context(stream);
  ctx.send = function(msg) {
    ctx.sent = ctx.sent || [];
    ctx.sent.push(msg);
  };
  ctx.once('variables', function(vars) {
    cb(ctx);
  });
  writeVars(stream);
};

describe('Context', function() {
  before(function(done) {
    var self = this;
    context(function(context) {
      self.context = context;
      done();
    });
  });
  describe('parsing variables', function() {
    it('works', function(done) {
      var vars = this.context.variables;
      expect(vars['agi_network']).ok();
      expect(vars['agi_network']).to.eql('yes');
      expect(vars['agi_uniqueid']).to.eql('13507138.14');
      expect(vars['agi_arg_1']).to.eql('test');
      done();

    });

    it('puts context into waiting state', function() {
      expect(this.context.state).to.eql(state.waiting);
    });
  });

  describe('sending command', function() {
    it('writes out', function() {
      this.context.send('EXEC test');
      expect(this.context.sent.length).to.eql(1);
      expect(this.context.sent.pop()).to.eql('EXEC test');
    });
  });

  describe('context.exec', function() {
    it('sends exec command', function() {
      this.context.exec('test', 'bang', 'another');
      expect(this.context.sent.pop()).to.eql('EXEC test bang another\n');
    });
  });

  describe('command flow', function() {
    describe('simple success', function() {
      it('works', function(done) {
        var context = this.context;
        context.on('response', function() {
          done();
        });
        process.nextTick(function() {
          context.exec('test', 'bang', 'another');
          context.stream.write('200');
          context.stream.write(' result=0\n\n');
        });
      });
    });
  });
});
