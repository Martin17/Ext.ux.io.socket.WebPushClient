
Ext.define('Sig.lib.io.socket.WebPushClient', {
	mixins : {
		observable : 'Ext.util.Observable'
	},
	connected : false,
	retries : 0,
	modernBrowsersOnly : true,
	config : {
		url : 'localhost:8000',
		protocols : [],
		maxRetries : 0,
		allowReconnect : true,
		ssl : false
	},
	initWebSocket : function() {
		if (window.WebSocket)
			return true
		if (this.modernBrowsersOnly)
			return false
		var path = Ext.Loader.getPath('Sig.lib.io.socket').replace('.js', '')
		if (typeof FABridge === 'undefined') {
			var fABridgeScript = document.createElement("script")
			fABridgeScript.type = "text/javascript"
			fABridgeScript.src = path + "/FABridge.js"
			document.getElementsByTagName('head')[0]
					.appendChild(fABridgeScript)
			window.WEB_SOCKET_SWF_LOCATION = path + "/WebSocketMain.swf"
		}
		if (typeof WebSocket === 'undefined') {
			var wsScript = document.createElement("script")
			wsScript.type = "text/javascript"
			wsScript.src = path + "/web_socket.js"
			document.getElementsByTagName('head')[0].appendChild(wsScript)
		}
		return true
	},
	constructor : function(config) {
		this.mixins.observable.constructor.call(this, config)
		this.initConfig(config)
	},

	connect : function() {
		var me = this
		var ws = (me.ssl) ? 'wss://' : 'ws://'
		var url = ws + me.url
		if (this.initWebSocket()) {
			if (!me.connected) {
				me.connection = new WebSocket(url, me.protocols || null)
				this.connection.onopen = function(data) {
					me.onConnect(data);
				}
				this.connection.onmessage = function(data) {
					me.onMessage(data);
				}
				this.connection.onclose = function(data) {
					me.onClose(data);
				}
				this.connection.onerror = function(err) {
					me.onError(err);
				}
			}
		} else {
			me.connection = {}
			me.connected = false
			this.fireEvent('error', this, {
						reason : 'Only modern Browsers with native WebSockets allowed',
						code : 0
					})
		}
	},
	disconnect : function() {
		if (this.fireEvent('beforedisconnect', this) !== false) {
			this.doDisconnect()
		}
	},
	doDisconnect : function() {
		this.fireEvent('disconnect', this)
		this.connected = false
		this.connection.onclose = Ext.emptyFn()
		this.connection.close()
	},
	send : function(msg) {
		this.fireEvent('send', this, msg)
		this.connection.send(msg)
	},
	onClose : function(data) {
		var me = this
		me.fireEvent('close', me, data)
		var time = 5000
		var reConnect = new Ext.util.DelayedTask(function() {
					me.connect()
				})
		if (me.connected == true) {
			if (me.allowReconnect) {
				reConnect.delay(time)
			} else {
				me.fireEvent('closed', me, data)
			}
		} else {
			if (me.retries == me.maxRetries) {
				me.fireEvent('closed', me, data)
				me.retries = 0;
			} else {
				me.retries = me.retries++
				reConnect.delay(time)
			}
		}
		me.connected = false
	},
	onConnect : function(data) {
		this.connected = true;
		this.fireEvent('connect', this, data)
	},
	onError : function(data) {
		var me = this
		me.connected = false
		var time = 5000
		var reConnect = new Ext.util.DelayedTask(function() {
					me.connect()
				})
		if (me.retries == me.maxRetries) {
			me.fireEvent('closed', me, 'Max retries reached!')
			me.retries = 0;
		} else {
			me.retries = me.retries++
			reConnect.delay(time)
		}
		me.fireEvent('error', me, data)
	},
	onMessage : function(message) {
		// var data = Ext.JSON.decode(message)
		this.fireEvent('message', this, message)
	}

})