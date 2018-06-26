'use strict';

const events = require('events');
const util = require('util');
const WebSocket = require('ws');
const chores = require('./chores');

function Client(params) {
  events.EventEmitter.call(this);

  params = params || {};

  let config = extractConnectionOpts(params);
  let logger = params.logger || chores.getDefaultLogger();
  let stateMap = params.stateMap || chores.STATE_MAP;
  let mapState = function(state) {
    return stateMap[state] || state;
  }
  let listener = params.listener || params.ws;

  let self = this;

  self.loadDefinition = function(callback) {
    self.execCommand({ name: 'definition', options: [] }, callback);
  };

  self.execCommand = function(command, callback) {
    let ws = listener ? listener : buildWebsocketClient(config);
    let wsCommand = chores.pick(command, ['name', 'mode', 'options', 'payload', 'package']);

    // @Deprecated
    wsCommand.command = command.name;
    wsCommand.data = command.data;

    ws.on('open', function open() {
      logger.debug(' - Websocket@client is opened');
      ws.send(JSON.stringify(wsCommand));
    });

    ws.on('message', function incomming(data) {
      logger.debug(' - Websocket@client is received a message data: %s', data);

      data = JSON.parse(data);

      data.command = data.command || command;

      switch(data.state) {
        case 'definition':
          ws.close();
          self.emit(mapState(data.state), data);
          callback && callback(null, data.value);
          break;
        case 'started':
        case 'completed':
        case 'cancelled':
        case 'failed':
        case 'timeout':
          self.emit(mapState(data.state), data);
          break;
        case 'done':
          ws.close();
          self.emit(mapState(data.state), data);
          callback && callback();
          break;
        case 'noop':
          ws.close();
          self.emit(mapState(data.state), data);
          callback && callback({
            name: 'IS_NOT_IMPLEMENTED',
            message: 'operation is not implemented'
          });
          break;
        default:
          if (stateMap[data.state]) {
            self.emit(stateMap[data.state], data);
          }
          break;
      }
    });

    ws.on('close', function handler(code, message) {
      self.emit(mapState('close'), code, message);
      logger.debug(' - Websocket@client is closed, code: %s, message: %s', code, message);
    });

    ws.on('error', function handler(error) {
      self.emit(mapState('error'), error);
      logger.debug(' - Websocket@client encounter an error: %s', error);
    });

    (typeof(ws.ready) === 'function') && ws.ready();
  };
}

util.inherits(Client, events.EventEmitter);

module.exports = Client;

const extractConnectionOpts = function(params) {
  params = params || {};
  return chores.pick(params.connection || params, [
    'url', 'host', 'port', 'path', 'authen', 'tunnel'
  ]);
}

const buildWebsocketClient = function(config) {
  let wsOpts = {};

  if (config.authen instanceof Object) {
    wsOpts.headers = wsOpts.headers || {};
    if (config.authen.token_jwt) {
      wsOpts.headers["Authorization"] = "JWT " + config.authen.token_jwt;
    }
    if (config.authen.token_key && config.authen.token_secret) {
      wsOpts.headers["X-Token-Key"] = config.authen.token_key;
      wsOpts.headers["X-Token-Secret"] = config.authen.token_secret;
    }
  }

  let sslEnabled = (config.tunnel instanceof Object && config.tunnel.enabled);
  if (sslEnabled) {
    wsOpts.rejectUnauthorized = config.tunnel.rejectUnauthorized || false;
  }

  let wsUrl = util.format('%s://%s:%s%s/execute',
    sslEnabled?'wss':'ws', config.host, config.port, config.path);

  return new WebSocket(wsUrl, null, wsOpts);
};
