var MemoryStream = require('memstream').MemoryStream;
var expect = require('expect.js');
var Context = require('./../').Context;
var state = require('./../').state;

//helpers
var writeVars = function(stream) {
  stream.write('agi_network: yes\n');
  stream.write('agi_uniqueid: 13507138.14\n');
  stream.write('agi_arg_1: test\n');
  stream.write('\n\n');
};

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
