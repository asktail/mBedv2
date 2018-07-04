(function(){
    $(document).on({
        dragleave:function(e){
            e.preventDefault();
        },
        drop:function(e){
            e.preventDefault();
        },
        dragenter:function(e){
            e.preventDefault();
        },
        dragover:function(e){
            e.preventDefault();
        }
    });
    var board = document.getElementById("board");
    var box = document.getElementById("uploader");
    var speaker = document.getElementById("speaker");
    var infopanel = document.getElementById("infopanel");
    var manualLoad = document.getElementById("manualLoad");
    window.server = "file.yuuno.cc";
    var myX = 0,
        myY = 0;
    var crt = null;
    var myclip = null;
    var cacheList = [];

    const IMAGETYPE = [
        "bmp", "png", "jpg", "jepg", "gif", "svg"
    ];

    var dateFormat = function (d, fmt) {
        var o = {
            "M+": d.getMonth() + 1,
            "d+": d.getDate(),
            "h+": d.getHours(),
            "m+": d.getMinutes(),
            "s+": d.getSeconds(),
            "q+": Math.floor((d.getMonth() + 3) / 3),
            "S": d.getMilliseconds()
        };
        if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (d.getFullYear() + "").substr(4 - RegExp.$1.length));
        for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        return fmt;
    }

    var showInfo = (e) => {
        alert(e);
    }

    var shake = () => {
        $(uploader).css("transform", "translateX(-5px)");
        setTimeout(() => {
            $(uploader).css("transform", "translateX(5px)");
            setTimeout(() => {
                $(uploader).css("transform", "translateX(-5px)");
                setTimeout(() => {
                    $(uploader).css("transform", "translateX(5px)");
                    setTimeout(() => {
                        $(uploader).css("transform", "");
                    }, 100);
                }, 100);
            }, 100);
        }, 100);
    }
    var setProgress = (e) => {
        if (e < 0) {
            $("#progressbar")[0].className = "disable";
            e = 0
        } else {
            $("#progressbar")[0].className = "";
        }
        if (e > 1) e = 1;
        $("#progress").css("width", (e * 100) + "%");
    }
    var doData = (e) => {
        if (e.status) {
            speaker.innerHTML = "n(*≧▽≦*)n 上傳成功啦!";
            cacheList.push(e.data);
            refreshList();
            localStorage.setItem("SlinkFB", JSON.stringify(cacheList));
            $.scrollTo(`#file_${e.data.identifier}`, 1000);
        } else {
            speaker.innerHTML = "/(ㄒoㄒ)/ 遇到錯誤啦...";
            infopanel.innerHTML = e.data;
        }
    }

    var uploadFile = (fileList) => {
        if (fileList.length === 0) {
            return false;
        }
        var fileInfo = {
            "type": fileList[0].type,
            "name": fileList[0].name,
            "size": Math.floor((fileList[0].size)/1024)
        };
        if (fileInfo.size > 6 * 1024) {
            infopanel.innerHTML = "上传文件大小不能超过 6 MBytes 喲.";
            speaker.innerHTML = "/(ㄒoㄒ)/ 喂得太多了啦 TAT";
            setProgress(-1);
            shake();
            return false;
        }
        if (fileInfo.type == "") {
            infopanel.innerHTML = "目前暫時不允許上傳文件夾.";
            speaker.innerHTML = "/(ㄒoㄒ)/ 喂得太多了啦 TAT";
            setProgress(-1);
            shake();
            return false;
        }
        speaker.innerHTML = "(๑•ᴗ•๑) 我在努力工作著呢 ~";
        infopanel.innerHTML = `上傳 ${fileInfo.name} , 已上傳 ${0} / ${fileInfo.size} KBytes.`;
        setProgress(0);
        // console.log(fileInfo);

        xhr = new XMLHttpRequest();
        xhr.open("post", `https://${window.server}/getSlink/`, true);
        var fd = new FormData();
        fd.append('file', fileList[0]);
        xhr.upload.onprogress = (evt) => {
            var current = parseInt(evt.loaded / 1024);
            current = current > fileInfo.size ? fileInfo.size : current;
            infopanel.innerHTML = `上傳 ${fileInfo.name} , 已上傳 ${current} / ${fileInfo.size} KBytes.`;
            setProgress(evt.loaded / evt.total);
        };
        xhr.onreadystatechange = () => {
            if (xhr.readyState == 4 && xhr.status == 200) {
                doData(JSON.parse(xhr.responseText));
            }
        };
        xhr.send(fd);
    }

    manualLoad.addEventListener("change", function(e){
        uploadFile(manualLoad.files);
    });
    box.addEventListener("click", function(e) {
        manualLoad.click();
    });
    box.addEventListener("drop", function(e) {
        e.preventDefault();
        return uploadFile(e.dataTransfer.files);
    });
    box.addEventListener("dragenter", function(e) {
        speaker.innerHTML = "~\\(≧▽≦)/~ 可以放手啦!";
    });
    box.addEventListener("dragleave", function(e) {
        speaker.innerHTML = "QAQ 我什麼文件都沒收到呢...";
    });

    var refreshList = () => {
        board.innerHTML = "";
        var chtml = "";
        cacheList.forEach(e => {
            visual = `<h1 id="title_${e.identifier}">${e.type}</h1>`;
            if ((e.hasOwnProperty("ctype") && e["ctype"].includes("image")) ||
                    IMAGETYPE.includes(e["type"].toLocaleLowerCase())) {
                visual = `<div id="title_p_${e.identifier}" class="pic" style="background-image: url(https://${window.server}/${e.identifier}&thumb=3);"></div>`;
            }
            chtml += `
            <div id="file_${e.identifier}" class="fileWrapper">
                ${visual}
                <ul>
                    <li>文件名稱:<in>${e.name}</in></li>
                    <li>文件大小:<in>${Math.floor(e.size / 1024)} KBytes</in></li>
                    <li>上傳日期:<in>${dateFormat(new Date(parseInt(e.date) * 1000), "yyyy-MM-dd hh:mm")}</in></li>
                    <li>剩餘天數:<in>infinite</in></li>
                </ul>
                <lr>
                    <a href="javascript:;" identifier="${e.identifier}" class="clp"><span>複製</span></a>
                    <a href="https://${window.server}/${e.identifier}" target="_blank"><span>下載</span></a>
                    <a href="javascript:;" identifier="${e.identifier}" class="x1s"><span>續一秒</span></a>
                    <a href="javascript:;" identifier="${e.identifier}" class="del"><span>刪除記錄</span></a>
                </lr>
            </div>
            `;
        });
        board.innerHTML = chtml;
        if (myclip != null) {
            myclip.destroy();
            myclip = null;
        }
        myclip = new Clipboard('.clp', {
            text: function(trigger) {
                $(".clp span").html("複製");
                $(".clp").css("color", "");
                $(`#file_${trigger.getAttribute('identifier')} lr .clp span`).html("成功");
                $(`#file_${trigger.getAttribute('identifier')} lr .clp`).css("color", "green");
                return `https://${window.server}/` + trigger.getAttribute('identifier');
            }
        });
        $(".x1s").on("click", (e) => {
            x1s($(e.currentTarget).attr("identifier"));
        });
        $(".del").on("click", (e) => {
            del($(e.currentTarget).attr("identifier"));
        });

        $(".pic").on("mousedown", (e) => {
            crt = $(e.currentTarget);
            crt.css("cursor", "-webkit-grabbing");
            crt.css("transition-duration", "0s");
            $("body").css("cursor", "-webkit-grabbing");
            myX = e.screenX;
            myY = e.screenY;
        });
    }
    $(window).on("mousemove", (e) => {
        if (null !== crt) {
            crt.css("background-position-x", e.screenX - myX);
            crt.css("background-position-y", e.screenY - myY);
            e.preventDefault();
        }
    });
    $(window).on("mouseup", (e) => {
        if (null !== crt) {
            $("body").css("cursor", "");
            crt.css("cursor", "");
            crt.css("transition-duration", "0.3s");
            crt.css("background-position-x", "");
            crt.css("background-position-y", "");
            crt = null;
        }
    });

    var x1s = (e) => {
        let eid = e;
        // $.get(`https://${window.server}/${e}&op=longer`, (e) => {
            // if (e.status) {
                $(".x1s span").html("續一秒");
                $(".x1s").css("color", "");
                $(`#file_${eid} lr .x1s span`).html("續.成功");
                $(`#file_${eid} lr .x1s`).css("color", "red");
            // }
        // });
    }
    var del = (e) => {
        let eid = e;
        // $.get(`https://${window.server}/${e}&op=del`, (e) => {
            var index = -1;
            for (var i = 0; i < cacheList.length; i++) {
                if (cacheList[i].identifier == eid) index = i;
            }
            if (index > -1) {
                cacheList.splice(index, 1);
                localStorage.setItem("SlinkFB", JSON.stringify(cacheList));
                refreshList();
            }
            // showInfo(e.data);
        // });
    }

    $(window).on("load", () => {
        init();
    })
    init = () => {
        cacheList = localStorage.getItem("SlinkFB");
        if (cacheList == null) cacheList = [];
        else cacheList = JSON.parse(cacheList);
        refreshList();
    }
})();
