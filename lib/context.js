var Readable = require('readable-stream');
var EventEmitter = require('events').EventEmitter;
var state = require('./state');

/*
 * --------------------------------------------------------------
 * Constructor
 * --------------------------------------------------------------
 */
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
	this.stream.on('error', this.emit.bind(this, 'error'));
	this.stream.on('close', this.emit.bind(this, 'close'));
};

/*
 * Inherit EventEmitter properties. Used for emitting our own 
 * events. 
 * --------------------------------------------------------------
 */
require('util').inherits(Context, EventEmitter);

/*
 * Read the data that we receive from Asterisk
 * --------------------------------------------------------------
 */
Context.prototype.read = function() {
	var buffer = this.stream.read();
	if(!buffer) return this.msg;
	this.msg += buffer.toString('utf8');
	if(this.state === state.init) {
		if(this.msg.indexOf('\n\n') < 0) return this.msg; //we don't have whole message
		this.readVariables(this.msg);
	} else if(this.state === state.waiting) {
		if(this.msg.indexOf('\n') < 0) return this.msg; //we don't have whole message
		this.readResponse(this.msg);
	}
	return "";
};

/*
 * Read the AGI variables on initialization of the channel
 * --------------------------------------------------------------
 */
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

/*
 * Read the response lines that we receive from Asterisk
 * --------------------------------------------------------------
 */
Context.prototype.readResponse = function(msg) {
	var lines = msg.split('\n');
	for(var i = 0; i < lines.length; i++) {
		this.readResponseLine(lines[i]);
	}
	return "";
};

/*
 * Parse each response line that we receive from Asterisk
 * --------------------------------------------------------------
 */
Context.prototype.readResponseLine = function(line) {
	if(!line) return;
	var parsed = /^(\d{3})(?: result=)(.*)/.exec(line);
	if(!parsed) {
		return this.emit('hangup');
	}
	var response = {
		code: parseInt(parsed[1]),
		result: parsed[2]
	};
	//our last command had a pending callback
	if(this.pending) {
		var pending = this.pending;
		this.pending = null;
		pending(null, response);
	}
	this.emit('response', response);
}

/*
 * Sets the state of this channel
 * --------------------------------------------------------------
 */
Context.prototype.setState = function(state) {
	this.state = state;
};

/*
 * Sends the given command to Asterisk. The command has be 
 * terminated with a new line character (\n).
 * --------------------------------------------------------------
 */
Context.prototype.send = function(msg, cb) {
	this.pending = cb;
	this.stream.write(msg);
};

/*
 * Executes a given Application. (Applications are the functions 
 * you use to create a dial plan in extensions.conf).
 * --------------------------------------------------------------
 */
Context.prototype.exec = function() {
	var args = Array.prototype.slice.call(arguments, 0);
	var last = args.pop();
	if(typeof last !== 'function') {
		args.push(last);
		last = function() { }
	}
	this.send('EXEC ' + args.join(' ') + '\n', last);
};

/*
 * Gets a channel variable.
 * --------------------------------------------------------------
 */
Context.prototype.getVariable = function(name, cb) {
	this.send('GET VARIABLE ' + name + '\n', cb || function() { });
};

/*
 * Send the given file on the channel, allowing playback to be 
 * interrupted by the given digits, if any.
 * --------------------------------------------------------------
 */
Context.prototype.streamFile = function(filename, acceptDigits, cb) {
	if(typeof acceptDigits === 'function') {
		cb = acceptDigits;
		acceptDigits = "1234567890#*";
	}
	this.send('STREAM FILE "' + filename + '" "' + acceptDigits + '"\n', cb);
};

/*
 * Waits up to <timeout> milliseconds for channel to receive
 * a DTMF digit. Use -1 for the <timeout> value if you desire 
 * the call to block indefinitely.
 * --------------------------------------------------------------
 */
Context.prototype.waitForDigit = function(timeout, cb) {
	if(typeof timeout === 'function') {
		cb = timeout;
		//default to 2 second timeout
		timeout = 5000;
	}
	this.send('WAIT FOR DIGIT ' + timeout + '\n', cb);
};


/*
 * Say a given digit string, returning early if any of the given 
 * DTMF digits are received on the channel.
 * --------------------------------------------------------------
 */
Context.prototype.sayDigitis = function(digits,escapeDigits,cb){
	if(typeof escapeDigits === 'function'){
		cb = escapeDigits;
		escapeDigits = "1234567890#*";
	}
	this.send('SAY DIGITS ' + digits + ' "' + escapeDigits + '"',cb);
}

/*
 * Tell Asterisk to Answer the call. Used in IVR's
 * --------------------------------------------------------------
 */
Context.prototype.answer = function(cb){
	this.send('ANSWER\n',cb);
}

/*
 * Logs a message to the Asterisk verbose log.
 * --------------------------------------------------------------
 */
Context.prototype.verbose = function(message,level,cb){
	if(typeof level === 'function'){
		cb = level;
		level = 1;
	}
	this.send('VERBOSE "' + message + '" ' + level + '\n',cb);
}

/*
 * Send the HANGUP command to Asterisk.
 * --------------------------------------------------------------
 */
Context.prototype.hangup = function(cb) {
	this.send('HANGUP\n', cb);
};

/*
 * Ends the current call. As from Asterisk v1.6 HANGUP command
 * doesn't end the call.
 * --------------------------------------------------------------
 */
Context.prototype.end = function() {
	this.stream.end();
};


module.exports = Context;
