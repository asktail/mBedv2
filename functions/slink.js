var https = require('https');
var crypto = require('crypto');

const APPID = process.env.bmob_for_use_app || "";
const APPSC = process.env.bmob_for_use_sec || "";

function request (uri, query={}, method='GET', server=1, addsHeaders={}, callback=()=>{}) {

    let queryData = '';
    if (method === 'GET') {
        for (let key in query) {
            queryData += `&${key}=${query[key]}`;
        }
        if (queryData) queryData = encodeURI('?' + queryData.substr(1));
    }

    let option = {
        host: 'api.bmob.cn',
        port: 443,
        path: `/${server}${uri}${queryData}`,
        headers: {
            'X-Bmob-Application-Id': APPID,
            'X-Bmob-REST-API-Key': APPSC,
            ...addsHeaders
        },
        method
    }

    let req = https.request(option, function (res) {
        res.setEncoding('utf-8');
        let html = "";
        res.on('data', function(data) { html += data; });
        res.on('end', function() {
            try {
                let data = JSON.parse(html); callback(data);
            } catch (error) {
                callback(null);
            }
        });
    });
    req.on('error', e => {
        callback(null);
    });

    if (method !== 'GET') {
        if (server === 1) req.write(JSON.stringify(query));
        else req.write(query);
    }
    req.end();

}

function retrieveURL (fid, callback) {
    request("/classes/moenya", {"where": `{"fid":"${fid}"}`}, 'GET', 1, {}, data => {
        let result = data ? data.results[0] : null;
        callback((result ? result.url : '').replace("http://", "https://"));
    });
}

function saveFile (info, content, callback) {
    request(`/files/${info.name}`, content, 'POST', 2, {"Content-Type": info.ctype}, data => {
        let {cdn, url} = data;
        let fid = info.lid;
        request("/classes/moenya", {fid, url, cdn}, 'POST', 1, {"Content-Type": "application/json"}, res => {
            callback(res);
        });
    });
}

function md5 (text) {
  return crypto.createHash('md5').update(text).digest('hex');
};

const min = (a, b) => a > b ? b : a;
const exp = /^(\w+):\/\/([^\/:]*)(?::(\d+))?(\/.*)/;

function getSlink (info, callback) {

    let siteId = process.env.site_for_use || "";

    var postData = `data=${JSON.stringify(info)}`;
    var options = {
        hostname: siteId,
        port: 443,
        path: '/slinkcon/mbed',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    };

    var req = https.request(options, function (res) {
        res.setEncoding('utf-8');
        let html = "";
        res.on('data', function(data) { html += data; });
        res.on('end', function() {
            try {
                data = JSON.parse(html).data;
                callback(data);
            } catch (error) {
                callback(null);
            }
        });
    });
    req.write(postData);
    req.end();
}

exports.handler = function (event, context, callback) {

    if (event.httpMethod !== "POST" || !event.isBase64Encoded) {
        callback(null, {
            statusCode: 200,
            body: JSON.stringify({status: false, error: "Illegal Operation!"})
        });
        return;
    }

    console.log(event);
    let time = parseInt((new Date()).getTime() / 1000, 10);
    let body = Buffer.from(event.body, 'base64');
    let start = Buffer.from('\r\n\r\n');
    let end = Buffer.from('\r\n--------------------------');
    let bstart = body.indexOf(start) + 4;
    let bend = body.lastIndexOf(end);
    let blength = bend - bstart;
    let content = new Buffer(blength);
    body.copy(content, 0, bstart, bend);
    let header = new Buffer(bstart);
    body.copy(header, 0, 0, bstart);
    header = header.toString().trim();
    // header = header.split("\r\n").filter(Boolean).filter(w => !w.startsWith("-"));
    let nameHeader = header.substr(header.indexOf("filename") + 10) + "\r;";
    let name = nameHeader.substr(0, min(nameHeader.indexOf("\r"), nameHeader.indexOf(";")) - 1);
    let typeHeader = header.substr(header.indexOf("Content-Type") + 14) + "\r;";
    let ctype = typeHeader.substr(0, min(typeHeader.indexOf("\r"), typeHeader.indexOf(";"))) || "application/octet-stream";
    let type = name.substr(name.lastIndexOf("."));
    let ip = event.headers["x-forwarded-for"] || "";
    let size = content.length;

    let lid = md5(`saveFile/${size}SFN${name}SlinkFile${type}${time}`);

    let recordedData = {
        name, size, type, ctype, ip, lid, time
    };

    getSlink(recordedData, slink => {
        saveFile(recordedData, content, res => {
            callback(null, {
                statusCode: 200,
                body: JSON.stringify({...recordedData, url: `https://file.yuuno.cc/${slink}`, slink})
            });
        });
    });

}
