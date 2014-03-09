;(function () {

var triggerEvents = function(events, args) {
	var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
		switch (args.length) {
		case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
		case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
		case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
		case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
		default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
	}
}

// Underscore utilities
var arrayKeys = Object.keys || function (obj) {
	if (obj !== Object(obj)) throw new TypeError('Invalid object');
	var keys = [];
	for (var key in obj) if (_.has(obj, key)) keys.push(key);
	return keys;
}

var slice = Array.prototype.slice;
var bind = function(func, context) {
	var args, bound;
	if (Function.prototype.bind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
	args = slice.call(arguments, 2);
	return bound = function() {
		if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
		ctor.prototype = func.prototype;
		var self = new ctor;
		ctor.prototype = null;
		var result = func.apply(self, args.concat(slice.call(arguments)));
		if (Object(result) === result) return result;
		return self;
	}
}

// Wrapper of addEventListener
var onWindowEvent = function onWindowEvent(eventName, callback, context) {
	if (typeof context === 'undefined')
		context = window;

	var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
	var eventer = window[eventMethod];

	eventer(eventName, function() {
		callback.apply(context, arguments);
	}, false);
}

// Utility to post message to iFrame
var PostMessage = function PostMessage(options) {
	this.initialize(options);
}

// options = {
//   target: window.parent or iframe.contentWindow
//   origin: Host of your application
//   destination: Host where the message are sent (Ex. http://example.com)
// }
PostMessage.prototype.initialize = function initialize(options) {
	if (!options.target)
		return console.error('You have to specify the target options to post a message.');
	if (!options.origin)
		return console.error('You have to specify the origin options for security reasons.');
	if (!options.destination)
		return console.error('You have to specify the destination options for security reasons.');

	var self = this;
	self._events = [];
	self._callbacks = {};
	self._callbackCounter = 0;
	self.options = options;

	self._target = options.target;
	delete options['target'];

	var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
	var eventer = window[eventMethod];
	var messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

	self._messageEventHandler = function() {
		self._messageHandler.apply(self, arguments);
	};
	eventer(messageEvent, self._messageEventHandler, false);
}

PostMessage.prototype._messageHandler = function _messageHandler(message) {
	// console.log('Raw message ' + this.options.name, message);

	if (message.origin !== this.options.destination)
		return console.warn('Message coming from a different origin: ' + message.origin + ' => ' + this.options.destination);

	var type = message.data.type;
	var data = message.data.data;
	var callbackId = message.data.callbackId;

	if (!type)
		return console.warn('Unknown message type');

	switch (type) {

		case 'callback':
			if (!callbackId)
				return console.warn('No callbackId provided on callback message');
			if (!this._callbacks[callbackId])
				return console.warn('Cannot find a callback with ID ' + callbackId);

			var callback = this._callbacks[callbackId];
			delete this._callbacks[callbackId];
			callback(data);
			break;

		default:
			if (callbackId && data !== undefined)
				this.trigger(type, data, this._createCallbackFunction(callbackId));
			else if (callbackId)
				this.trigger(type, this._createCallbackFunction(callbackId));
			else if (data !== undefined)
				this.trigger(type, data);
			else
				this.trigger(type);
	}
}

PostMessage.prototype._createCallbackFunction = function _createCallbackFunction(callbackId) {
	var self = this;
	return function (data) {
		var newMessage = {
			type: 'callback',
			data: data,
			callbackId: callbackId
		}
		self._target.postMessage(newMessage, self.options.destination);
	}
}

PostMessage.prototype.emit = function emit(type, data, callback) {
	if (typeof data === 'function') {
		callback = data;
		data = undefined;
	}

	if (typeof callback === 'function') {
		var callbackId = ++this._callbackCounter;
		this._callbacks[callbackId] = callback;
	}

	var newMessage = {
		type: type,
		data: data,
		callbackId: callbackId
	}

	this._target.postMessage(newMessage, this.options.destination);
}

PostMessage.prototype.on = function on(name, callback, context) {
	if (!callback) return this;
	var events = this._events[name] || (this._events[name] = []);
	events.push({ callback: callback, context: context, ctx: context || this });
	return this;
}

PostMessage.prototype.trigger = function trigger(name) {
	if (!this._events) return this;
	var args = [].slice.call(arguments, 1);
	var events = this._events[name];
	if (events) triggerEvents(events, args);
	return this;
}

PostMessage.prototype.destroy = function destroy() {
	var eventMethod = window.removeEventListener ? "removeEventListener" : "detachEvent";
	var eventer = window[eventMethod];
	var messageEvent = eventMethod == "detachEvent" ? "onmessage" : "message";
	eventer(messageEvent, this._messageEventHandler, false);
}




// UkkioSDK
var UkkioSDK = function UkkioSDK(options) {
	this.initialize(options);
}


UkkioSDK.prototype.initialize = function initialize(options) {
	var self = this;
	if (window.self === window.top)
		return self.handleErrors('UkkioSDK must be executed under sandbox or play room. For more informations see http://developer.ukk.io');

	self._parent = window.parent;
	self._events = {};

	if (typeof options === 'undefined')
		self.options = {};
	else
		self.options = options;

	if (!self.options.origin) {
		self.options.origin = window.location.protocol + '//' + window.location.hostname;
		if (parseInt(window.location.port) != 80)
			self.options.origin += ':' + window.location.port;
	}

	if (!self.options.destination) {
		self.options.destination = window.location.protocol + '//' + window.location.hostname;
		self.options.destination += ':' + (parseInt(window.location.port) - 1);
	}

	self._postMessage = new PostMessage({
		name: 'client',
		target: window.parent,
		origin: self.options.origin,
		destination: self.options.destination
	});

	self._postMessage.on('newGame', this.onNewGame, self);
	self._postMessage.on('changeViewport', this.onChangeViewport, self);
	self._postMessage.on('pause', this.onPause, self);
	self._postMessage.on('unpause', this.onUnpause, self);

	onWindowEvent('focus', this.onFocus, self);
	onWindowEvent('blur', this.onBlur, self);
}

// Backbone implementation
UkkioSDK.prototype.on = function on(name, callback, context) {
	if (!callback) return this;
	var events = this._events[name] || (this._events[name] = []);
	events.push({ callback: callback, context: context, ctx: context || this });
	return this;
}

// Backbone implementation
UkkioSDK.prototype.off = function off(name, callback, context) {
	var retain, ev, events, names, i, l, j, k;
	if (!name && !callback && !context) {
		this._events = {};
		return this;
	}

	names = name ? [name] : arrayKeys(this._events);
	for (i = 0, l = names.length; i < l; i++) {
		name = names[i];
		if (events = this._events[name]) {
			this._events[name] = retain = [];
			if (callback || context) {
				for (j = 0, k = events.length; j < k; j++) {
					ev = events[j];
					if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
						(context && context !== ev.context)) {
						retain.push(ev);
					}
				}
			}
			if (!retain.length) delete this._events[name];
		}
	}

	return this;
}

// Backbone implementation
UkkioSDK.prototype.trigger = function trigger(name) {
	if (!this._events) return this;
	var args = [].slice.call(arguments, 1);
	var events = this._events[name];
	if (events) triggerEvents(events, args);
	return this;
}

// Send a message to the host check if the service is ready
UkkioSDK.prototype.ready = function ready(settings) {
	var data;
	data = settings || {};
	data.apiKey = this.options.apiKey;
	this._postMessage.emit('ready', data);
	return this;
}

// Request an insert coin
UkkioSDK.prototype.insertCoin = function insertCoin(fn) {
	this._postMessage.emit('insertCoin', function (result) {
		fn(result);
	});
	return this;
}

// Save custom data into the current game slot. This data
// will be lost on a new game.
UkkioSDK.prototype.saveSession = function saveSession(data, fn) {
	this._postMessage.emit('saveSession', data, function (result) {
		if (typeof fn === 'function')
			fn(result);
	});
	return this;
}

// Load custom data for the current match
UkkioSDK.prototype.loadSession = function loadSession(fn) {
	this._postMessage.emit('loadSession', function (data) {
		if (typeof fn === 'function')
			fn(data);
	});
	return this;
}

// Save user's persistent data
UkkioSDK.prototype.saveStorage = function saveStorage(data, fn) {
	this._postMessage.emit('saveStorage', data, function (result) {
		if (typeof fn === 'function')
			fn(result);
	});
	return this;
}

// Load user's persistent data
UkkioSDK.prototype.loadStorage = function loadStorage(fn) {
	this._postMessage.emit('loadStorage', function (data) {
		if (typeof fn === 'function')
			fn(data);
	});
	return this;
}

// The game is over
UkkioSDK.prototype.gameOver = function gameOver(fn) {
	this._postMessage.emit('gameOver', function (result) {
		if (typeof fn === 'function')
			fn(result);
	});
	return this;
}

// Exit the game
UkkioSDK.prototype.exit = function exit() {
	this._postMessage.emit('exit');
}

// Ukkio event of type newGame is coming
UkkioSDK.prototype.onNewGame = function onNewGame(data) {
	this.trigger('newGame', data);
}

// Request pause sending data to save the state of the game
UkkioSDK.prototype.onPause = function onPause(fn) {
	this.trigger('pause', function (gameData) {
		fn(gameData);
	});
}

// Request of resume the game. The last saved state is returned
UkkioSDK.prototype.onUnpause = function onUnpause(gameData) {
	this.trigger('unpause', gameData);
}

// Window or rotation is changed
UkkioSDK.prototype.onChangeViewport = function onChangeViewport(viewport) {
	this.trigger('changeViewport', viewport);
}

// Handle warning message comes from SDK
UkkioSDK.prototype.handleWarnings = function handleWarnings(msg) {
	if (console.warn) console.warn(msg);
	return this;
}

// Handle warning message comes from SDK
UkkioSDK.prototype.handleErrors = function handleErrors(msg) {
	if (console.error) console.error(msg);
	return this;
}

// Window get focus
UkkioSDK.prototype.onFocus = function onFocus(e) {
	this._postMessage.emit('active', true);
}

// Window lost focus
UkkioSDK.prototype.onBlur = function onBlur(e) {
	this._postMessage.emit('active', false);
}

// Clean up handlers
UkkioSDK.prototype.destroy = function destroy() {
	this._postMessage.destroy();
}

if (typeof exports == 'object') {
	exports = module.exports = UkkioSDK;
} else if (typeof define == 'function' && define.amd) {
	define(function(){ return UkkioSDK; });
} else {
	window['UkkioSDK'] = UkkioSDK;
}

})();