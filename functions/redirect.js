var https = require('https');

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

function getUrl (slink, callback) {

    let siteId = process.env.site_for_use || "";

    https.get(`https://${siteId}/slinkcon/mbed/${slink}`, function (res) {
        res.setEncoding('utf-8');
        let html = "";
        res.on('data', function(data) {
            html += data;
        });
        res.on('end', function() {
            try {
                let data = JSON.parse(html);
                data = JSON.parse(data.data);
                if (data && data.lid) {
                    bmob.retrieveURL(data.lid, callback);
                } else {callback(null);}
            } catch (error) {
                callback(null);
            }
        });
    });
}

exports.handler = function (event, context, callback) {

    let slink = event.queryStringParameters.slink || "";
    getUrl(slink, url => {
        callback(null, {
            statusCode: 302,
            headers: { "Location": url || "https://error.yuuno.cc" },
            body: ""
        });
    });

}
