# node-agi

Client for asterisk AGI protocol.  Parses incomming messages into events.  Dispatches AGI commands and their responses from asterisk.  Most commonly used as a low level client for a fAGI server.

## note: still a work in progress

## install
```
npm install agi
```

## API

### new Context(stream)

Constructor to create a new instance of a context.  Supply a readable and writable stream to the constructor.  Commonly _stream_ will be a `net.Socket` instance.

### context.exec(command, [args], [callback])

Dispatches the `EXEC` AGI command to asterisk with supplied command name and arguments.  _callback_ is called with the result of the dispatch.

```js
context.exec('ANSWER', function(err, res) {
  //the channel is now answered
});

context.exec('RecieveFax', '/tmp/myfax.tif', function(err, res) {
  //fax has been recieved by asterisk and written to /tmp/myfax.tif
});
```
