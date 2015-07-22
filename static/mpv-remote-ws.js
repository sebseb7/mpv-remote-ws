// namespace
var MPV_REMOTE_WS = {};
// websocket init
var ws = new WebSocket('ws://' + window.location.host + '/ws');
ws.onmessage = function(ev){
    var response = JSON.parse(ev.data);
    if (response.id in MPV_REMOTE_WS.connection.onmessage_handlers) {
        MPV_REMOTE_WS.connection.onmessage_handlers[response.id](response.result);
        if (typeof response.id === 'number')
            delete MPV_REMOTE_WS.connection.onmessage_handlers[response.id];
    }
}
ws.onclose = function(ev){

}
ws.onerror = function(ev){

}

var Connection = function(address) {
    this.req_id = 0;
    this.onmessage_handlers = {};

    this.send = function(data, cb) {
        if (cb)
            this.onmessage_handlers[this.req_id] = cb;
        data.id = this.req_id;
        this.req_id += 1;
        MPV_REMOTE_WS.ws.send(JSON.stringify(data));
    }
}

// mpv commands
var MpvProcess = function() {};

MpvProcess.prototype.get_property = function(name, cb, _native) {
    var method = 'get_property';
    if (_native) method += '_native';
    this._send_message(method, [name], cb);
}

MpvProcess.prototype.get_property_native = function(name, cb) {
    this.get_property(name, cb, true);
}

MpvProcess.prototype.set_property = function(name, val, cb) {
    var method = 'set_property';
    this._send_message(method, [name, val], cb);
}

MpvProcess.prototype.commandv = function(params, cb) {
    var method = 'commandv';
    this._send_message(method, params, cb);
}

MpvProcess.prototype.play_file = function(path) {
    var method = 'play_file';
    this._send_message(method, path);
}

MpvProcess.prototype.pause = function() {
    this.commandv(['cycle', 'pause']);
}

MpvProcess.prototype.stop = function() {
    this.commandv(['stop']);
}

MpvProcess.prototype.cycle_aspect = function() {
    this.commandv(['osd-msg', 'cycle-values', 'video-aspect', '16:9', '4:3', '2.35:1', '-1']);
}

MpvProcess.prototype.set_vol = function(val) {
    this.commandv(['osd-msg-bar', 'set', 'volume', val]);
}

MpvProcess.prototype.seek = function(seconds) {
    this.commandv(['osd-msg-bar', 'seek', seconds]);
}

MpvProcess.prototype.chapter = function(amount) {
    this.commandv(['osd-msg-bar', 'add', 'chapter', amount]);
}

MpvProcess.prototype.chapter_next = function() {
    this.chapter(1);
}

MpvProcess.prototype.chapter_prev = function() {
    this.chapter(-1);
}

MpvProcess.prototype.subdelay = function(seconds) {
    this.commandv(['osd-msg', 'add', 'sub-delay', seconds]);
}

MpvProcess.prototype.audiodelay = function(seconds) {
    this.commandv(['osd-msg', 'add', 'audio-delay', seconds]);
}

MpvProcess.prototype.cycle_sub = function() {
    this.commandv(['osd-msg', 'cycle', 'sub']);
}

MpvProcess.prototype.cycle_audio = function() {
    this.commandv(['osd-msg', 'cycle', 'audio']);
}

MpvProcess.prototype.toggle_drc = function() {
    this.commandv(['osd-msg', 'af', 'toggle', 'drc']);
}

MpvProcess.prototype._send_message = function(method, params, cb) {
    MPV_REMOTE_WS.connection.send({
        method: 'mpv_command',
        params: {
            method: method,
            params: params
        }
    }, cb);
}

// UI
var sorting = function(attr, reverse) {
    return function(a, b) {
        if (reverse) b = [a, a = b][0];
        if (attr == 'path') {
            a = a.path[a.path.length - 1];
            b = b.path[b.path.length - 1];
        }
        else if (attr == 'modified') {
            a = a.modified;
            b = b.modified;
        }
        if (a < b)
            return -1;
        if (b < a)
            return 1;
        return 0;
    }
}

var FileBrowser = function() {};

FileBrowser.prototype.open = function(path) {
    this.get_folder_content(path, this.render);
}

FileBrowser.prototype.get_folder_content = function(path, cb) {
    MPV_REMOTE_WS.connection.send({
        method: 'folder_content',
        params: path
    }, cb);
}

FileBrowser.prototype.render = function(content) {
    var _this = this;
    this.path = content.path;
    this.content = content.content;

    var files = this.content.filter(function(i) {
        return i.type == 'file';
    }).sort(sorting('path'));

    var folders = this.content.filter(function(i) {
        return i.type == 'dir';
    }).sort(sorting('modified', true));

    var sorted_content = [];
    var first = 'folders';
    if (first == 'folders') {
        sorted_content = folders.concat(files);
    }
    else if (first == 'files') {
        sorted_content = files.concat(folders);
    }


    var filebrowser_element = document.getElementById('filebrowser');
    filebrowser_element.innerHTML = '';

    var path_listing = document.createElement('ul');
    var dir_listing = document.createElement('ul');
    filebrowser_element.appendChild(path_listing);
    filebrowser_element.appendChild(dir_listing);

    var activate_path_link = function(link, i) {
        link.onclick = function() {
            MPV_REMOTE_WS.filebrowser.open(_this.path.slice(0, i + 1));
            return false;
        }
    }

    for (var i = 0; i < this.path.length; i++) {
        var link = document.createElement('a');
        link.href = '#';
        link.innerHTML = this.path[i];
        activate_path_link(link, i);
        var li = document.createElement('li');
        li.appendChild(link);
        path_listing.appendChild(li);
    }

    sorted_content.forEach(function(i) {
        var link = document.createElement('a');
        link.href = '#';
        link.innerHTML = i.path[i.path.length - 1];
        link.onclick = function() {
            if (i.type == 'file')
                MPV_REMOTE_WS.mp.play_file(i.path);
            else if (i.type == 'dir')
                MPV_REMOTE_WS.filebrowser.open(i.path);
            return false;
        }
        var li = document.createElement('li');
        li.appendChild(link);
        dir_listing.appendChild(li);
    });
}

FileBrowser.prototype.hide = function() {
    document.getElementById('filebrowser').innerHTML = '';
}

// instantiation
MPV_REMOTE_WS.filebrowser = new FileBrowser();
MPV_REMOTE_WS.ws = ws;
MPV_REMOTE_WS.connection = new Connection();
MPV_REMOTE_WS.mp = new MpvProcess();
ws.onopen = function(){
    MPV_REMOTE_WS.filebrowser.open(['E:\\', 'torrent']);
}

// var remote = {
//     render: function() {
//         document.getElementById('remote').innerHTML = 'TODO';
//     },

//     hide: function() {
//         document.getElementById('remote').innerHTML = '';
//     }
// }

// other stuff
// ws_onmessage_handlers['media-title'] = function(data) {
//     document.getElementById('title').innerHTML = data;
// }

// ws_onmessage_handlers['time-pos'] = function(data) {
//     document.getElementById('pos').innerHTML = data;
// }

// ws_onmessage_handlers['idle'] = function(data) {
//     document.getElementById('idle').innerHTML = data;
// }

var debug = function (text) {
    console.log(text);
}
