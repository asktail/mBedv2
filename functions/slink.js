var https = require('https');
var crypto = require('crypto');

let siteId = process.env.site_for_use || "";
let VERBOSE = process.env.site_for_verbose || "0";
const log = function(...text) {
    if (VERBOSE !== "0") console.log(`[MB ${parseInt((new Date()).getTime() / 1000, 10)}]`, ...text)
}
function md5 (text) {
  return crypto.createHash('md5').update(text).digest('hex');
};
const min = (a, b) => a > b ? b : a;
function request (host, uri, query={}, method='GET', headers={}, callback=()=>{}) {

    return new Promise((resolve, reject) => {

        let postData = "";
        if (method !== 'GET') {
            if (typeof query === 'object' && !Buffer.isBuffer(query)) {
                if (headers["Content-Type"] && headers["Content-Type"].includes("json")) {
                    postData = JSON.stringify(query);
                } else {
                    postData = "";
                    for (let key in query) {
                        postData += `&${key}=${escape(query[key])}`;
                    }
                    postData = postData.substr(1);
                }
            } else postData = query;
        }

        let queryData = '';
        if (method === 'GET') {
            if (typeof query === 'object') {
                for (let key in query) {
                    queryData += `&${key}=${query[key]}`;
                }
                if (queryData) queryData = encodeURI('?' + queryData.substr(1));
            } else {queryData = encodeURI(query);}
        }

        let option = {
            host,
            port: 443,
            path: `${uri}${queryData}`,
            headers : {
                "Connection": "keep-alive",
                "User-Agent": "SlinkClient/1.0",
                "Content-Length": postData.length,
                ...headers
            },
            method
        }

        let req = https.request(option, function (res) {
            res.setEncoding('utf-8');
            let html = "";
            res.on('data', function(data) { html += data; });
            res.on('end', function() {
                try {
                    let data = JSON.parse(html); callback(data); resolve(data);
                } catch (error) {
                    callback(null); reject(error);
                }
            });
        });
        req.on('error', e => {
            callback(null); reject(e);
        });

        if (method !== "GET") req.write(postData);
        req.end();

    });

}
function mrequest(uri, query, key, method='GET', headers={}) {
    return request("graph.microsoft.com", "/v1.0/me/drive/root" + encodeURI(uri), query, method, {
        "Authorization": "bearer " + key,
        ...headers
    });
}
function getKey (callback) {

    request(siteId, "/slinkkey/moenya/odrefresh,odtoken,odexpire,clientid,redirecturi,clientsc").then(data => {
        let expire = (parseInt(data.odexpire, 10) || 0) < ((new Date()).getTime() / 1000);
        if (!expire) { callback(data.odtoken); return; }
        request("login.microsoftonline.com", "/common/oauth2/v2.0/token", {
            client_id: data.clientid,
            redirect_uri: data.redirecturi,
            client_secret: data.clientsc,
            refresh_token: data.odrefresh,
            grant_type: "refresh_token"
        }, "POST", { "Content-Type": "application/x-www-form-urlencoded" }).then(res => {
            if (res["access_token"] && res["refresh_token"] && res["expires_in"]) {
                request(siteId, "/slinkkey/moenya/odrefresh,odtoken,odexpire", {
                    odrefresh: res["refresh_token"],
                    odtoken: res["access_token"],
                    odexpire: (parseInt(res["expires_in"], 10) + parseInt((new Date()).getTime() / 1000, 10) - 60)
                }, "POST", { "Content-Type": "application/x-www-form-urlencoded" }).then(ans => {
                    callback(res["access_token"]);
                });
            }
        });
    })

}
function parseData(data) {
    if (!data.error) {
        let url = data["@microsoft.graph.downloadUrl"];
        let time = parseInt((new Date(data["createdDateTime"])).getTime() / 1000, 10);
        let name = data["name"];
        let size = data["size"];
        let type = data["file"]["mimeType"];
        let hash = data["file"]["hashes"]["sha1Hash"];
        return {url, time, name, size, type, hash};
    } else {
        return null;
    }
}
function getFile(path, thumb=0) {
    return new Promise((resolve) => {
        getKey(token => {
            mrequest(`:/upload${path}`, {}, token).then(data => {
                let resData = parseData(data);
                if (thumb !== 0 && resData.type.includes("image")) {
                    getThumbnail(path, thumb, token).then(res => {
                        resData.originUrl = resData.url;
                        resData.url = res[0];
                        resData.thumb = res[1];
                        resolve(resData);
                    }).catch(err => {
                        resolve(resData);
                    })
                } else {
                    resolve(resData);
                }
            })
        });
    })
}
function saveFile(path, content, type) {
    return new Promise((resolve) => {
        getKey(token => {
            mrequest(`:/upload${path}:/content`, content, token, 'PUT', {"Content-Type": type}).then(data => {
                resolve(parseData(data));
            });
        });
    })
}
function getThumbnail(path, thumb, token) {
    return new Promise((resolve, reject) => {
        let allSizes = ["", "large", "medium", "small"];
        thumb = parseInt(thumb, 10);
        if (!thumb || thumb < 1 || thumb > 3) { reject(path); return; }
        let size = allSizes[thumb];
        getKey(token => {
            mrequest(`:/upload${path}:/thumbnails/0`, {select: size}, token).then(data => {
                resolve([data[size].url, thumb]);
            })
        });
    })
}

const uniExp = /[\u0100-\uffff]/g;
function getSlink (info, slink=null, token=null, callback) {

    slink = (slink && token) ? `/${slink}?token=${token}` : "";

    var postData = `data=${JSON.stringify(info)}`;
    var options = {
        hostname: siteId,
        port: 443,
        path: `/slinkcon/mbed${slink}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length + (postData.match(uniExp) || []).length
        }
    };

    var req = https.request(options, function (res) {
        res.setEncoding('utf-8');
        let html = "";
        res.on('data', function(data) { html += data; });
        res.on('end', function() {
            try {
                data = JSON.parse(html);
                callback(data.data, data.token, data.index || 0);
            } catch (error) {
                console.log("Get Slink Error", error);
                callback(null, null, 0);
            }
        });
    });
    req.write(postData);
    req.end();
}

const MAXLEN = 5 * 1024 * 1024;
function parseBody(body, ip) {
    try {
        let time = parseInt((new Date()).getTime() / 1000, 10);
        let start = Buffer.from('\r\n\r\n');
        let end = Buffer.from('\r\n--');
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
        let size = content.length;
        return [content, { name, size, type, ctype, ip, time }];
    } catch(err) {
        console.log("Error of Request", ip);
        console.log(err);
        return [null, null];
    }
}

exports.handler = function (event, context, callback) {

    let slink = event.queryStringParameters.slink || null;
    let token = event.queryStringParameters.token || null;
    let ip = event.headers["x-forwarded-for"] || "";

    console.log(`Start Handling Request of ${ip} with ${slink} - ${token}`);

    log("Receive Request From", ip);
    if (event.httpMethod !== "POST" || !event.isBase64Encoded) {
        callback(null, {
            statusCode: 200,
            body: JSON.stringify({status: false, error: "Illegal Operation!"})
        });
        return;
    }
    log("Process Request From", ip);

    let time = parseInt((new Date()).getTime() / 1000, 10);
    let body = Buffer.from(event.body, 'base64');

    if (body.length > MAXLEN) {
        callback(null, {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST",
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify({status: false, data: "Entity too large!"})
        });
        return;
    }

    
    let [content, recordedData] = parseBody(body, ip);
    if (!recordedData) {
        callback(null, {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST",
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify({status: false, data: "Unknown Request Format!"})
        });
        return;
    }

    let { name, ctype } = recordedData;
    log("Done Converting From", ip);

    getSlink(recordedData, slink, token, (slink, token, idx) => {

        log("Done Getting Slink", ip);

        if (!slink) {
            callback(null, {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST",
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify({status: false, data: "Identity Error!"})
            });
            return;
        }

        saveFile(`/${slink}/${name}`, content, ctype).then(res => {

            log("Done Saving", ip);

            callback(null, {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST",
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify({status: true, data: {...recordedData, url: `https://file.yuuno.cc/${slink}`, identifier: slink, date: time, token, index: idx}})
            });

        });

    });

}
