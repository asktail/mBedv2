var https = require('https');
var crypto = require('crypto');
var bmob = require('./bmob');

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
                data = JSON.parse(html).data.slink;
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
        bmob.saveFile(recordedData, content, res => {
            callback(null, {
                statusCode: 200,
                body: JSON.stringify({...recordedData, url: `https://file.yuuno.cc/${slink}`, slink})
            });
        });
    });

}
