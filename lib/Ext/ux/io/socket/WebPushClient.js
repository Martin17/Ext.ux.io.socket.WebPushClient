Ext.define('Ext.ux.io.socket.WebPushClient', {
    mixins: {
        observable: 'Ext.util.Observable'
    },
    /**
     * @private
     */
    connected: false,
    /**
     * @private
     */
    retries: 0,
    /**
     * @var restrict older browsers support (flash fallback)
     */
    modernBrowsersOnly: true,
    config: {
        /**
         * @var string url of websocket server
         */
        url: 'localhost:8000',
        /**
         * @var ws protocol (optional)
         */
        protocols: [],
        /**
         * @var max connection retries
         */
        maxRetries: 0,
        /**
         * @var allow reconnect to server
         */
        allowReconnect: true,
        /**
         * @var enable ssl connection
         */
        ssl: false,
        /**
         * @var path to web_socket and swfobject libraries (needed for older browsers)
         */
        path: undefined
    },
    initWebSocket: function () {
        if (window.WebSocket) {
            return true;
        }
        if (this.modernBrowsersOnly) {
            Ext.Error.raise('Solamente navegadores modernos');
            return false;
        }
        var path = this.getPath() || Ext.Loader.getPath('Sig.lib.io.socket').replace('.js', ''),
            swfobjectScipt,
            wsScript;
        if (typeof swfobject === 'undefined') {
            swfobjectScipt = document.createElement("script");
            swfobjectScipt.type = "text/javascript";
            swfobjectScipt.src = path + "/swfobject.js";
            document.getElementsByTagName('head')[0].appendChild(swfobjectScipt);
            window.WEB_SOCKET_SWF_LOCATION = path + "/WebSocketMain.swf";
        }
        if (typeof WebSocket === 'undefined') {
            wsScript = document.createElement("script");
            wsScript.type = "text/javascript";
            wsScript.src = path + "/web_socket.js";
            document.getElementsByTagName('head')[0].appendChild(wsScript);
        }
        return true;
    },
    constructor: function (config) {
        this.mixins.observable.constructor.call(this, config);
        this.initConfig(config);
    },

    applySsl: function () {
        if (this.connected) {
            this.disconnect();
            this.connect();
        }
    },
    connect: function () {
        var me = this, ws = (me.ssl) ? 'wss://' : 'ws://', url = ws + me.url;
        if (me.initWebSocket()) {
            if (!me.connected || me.allowReconnect) {
                me.fireEvent('connect', me);
                if (me.protocols.length > 0) {
                    me.connection = new WebSocket(url, me.protocols);
                } else {
                    me.connection = new WebSocket(url);
                }

                me.connection.onerror = function (err) {
                    me.onError(err);
                };
                me.connection.onopen = function (data) {
                    me.onConnect(data);
                };
                me.connection.onmessage = function (data) {
                    me.onMessage(data);
                };
                me.connection.onclose = function (data) {
                    me.onClose(data);
                };
            }
        } else {
            me.connection = {};
            me.connected = false;
            me.fireEvent('error', me, {
                reason: 'Only modern Browsers with native WebSockets allowed',
                code: 0
            });
        }
    },
    disconnect: function () {
        if (this.fireEvent('beforedisconnect', this) !== false) {
            this.doDisconnect();
        }
    },
    doDisconnect: function () {
        this.fireEvent('disconnect', this);
        this.connected = false;
        this.connection.onclose = Ext.emptyFn();
        this.connection.close();
    },
    send: function (msg) {
        this.fireEvent('send', this, msg);
        this.connection.send(msg);
    },
    onClose: function (data) {
        var me = this, time = 5000, reConnect = new Ext.util.DelayedTask(function () {
            me.connect();
        });
        me.fireEvent('close', me, data);
        if (me.connected === true) {
            if (me.allowReconnect) {
                reConnect.delay(time);
            } else {
                me.connected = false;
                me.fireEvent('closed', me, data);
            }
        } else {
            if (me.maxRetries > 0) {
                if (me.retries === me.maxRetries) {
                    me.connected = false;
                    me.fireEvent('closed', me, 'Max retries reached!');
                    me.retries = 0;
                } else {
                    me.retries = me.retries += 1;
                    reConnect.delay(time);
                }
            } else {
                me.retries = me.retries += 1;
                reConnect.delay(time);
            }

        }
    },
    onConnect: function (data) {
        this.connected = true;
        this.retries = 0;
        this.fireEvent('connected', this, data);
    },
    onError: function (data) {
        var me = this, time, reConnect;
        me.connected = false;
        time = 5000;
        reConnect = new Ext.util.DelayedTask(function () {
            me.connect();
        });
        if (me.maxRetries > 0) {
            if (me.retries === me.maxRetries) {
                me.fireEvent('closed', me, 'Max retries reached!');
                me.retries = 0;
            } else {
                me.retries = me.retries += 1;
                reConnect.delay(time);
            }
        } else {
            me.retries = me.retries += 1;
            reConnect.delay(time);
        }
        me.fireEvent('error', me, data);
    },
    onMessage: function (message) {
        // var data = Ext.JSON.decode(message)
        this.fireEvent('message', this, message);
    }

});
