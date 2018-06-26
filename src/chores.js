'use strict';

const pinbug = require('./pinbug');

const pinbugScope = 'devebot-api:';
const loggingLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

const pinbugWrapper = {};
loggingLevels.forEach(function(level) {
  pinbugWrapper[level] = pinbug(pinbugScope + level);
});

const defaultLogger = {};
loggingLevels.forEach(function(level) {
  defaultLogger[level] = function() {
    pinbugWrapper[level].enabled && pinbugWrapper[level].apply(null, arguments);
  }
});

const STATE_MAP = {
  "definition": "definition",
  "enqueque": "started",
  "progress": "progress",
  "failed": "failure",
  "complete": "success",
  "done": "done",
  "noop": "noop"
}

function Chores() {
  this.isArray = function(a) {
    return a instanceof Array;
  }
  
  this.isString = function(s) {
    return typeof(s) === 'string';
  }

  this.isFunction = function(f) {
    return typeof f === 'function';
  }

  this.isObject = function(o) {
    return o && typeof o === 'object';
  }

  this.ary = function(func, n) {
    if (n == undefined || n < 0) return func;
    if (this.isFunction(func) && n >= 0) {
      return function() {
        func.apply(null, Array.prototype.slice.call(arguments, 0, n));
      }
    }
  }

  this.omit = function(source, fieldNames) {
    let target = {};
    if (this.isObject(source) && this.isArray(fieldNames)) {
      Object.keys(source).forEach(function(fieldName) {
        if (fieldNames.indexOf(fieldName) < 0) {
          target[fieldName] = source[fieldName];
        }
      })
    }
    return target;
  }

  this.pick = function(source, fieldNames) {
    let target = {};
    if (this.isArray(fieldNames)) {
      fieldNames.forEach(function(fieldName) {
        if (fieldName in source) {
          target[fieldName] = source[fieldName];
        }
      });
    }
    return target;
  }

  this.getDefaultLogger = function() {
    return defaultLogger;
  }

  this.STATE_MAP = STATE_MAP;
}

module.exports = new Chores();
