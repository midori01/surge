let args = Object.fromEntries(new URLSearchParams($argument));

(async () => {
  let info = await getDataInfo(args.url);
  if (!info) return $done();
  let { download, upload, total, expire } = info;
  let used = download + upload;
  let expireInfo;
  if (expire && expire !== "false") {
    expire = /^[\d.]+$/.test(expire) ? expire * 1000 : expire;
    expireInfo = new Date(expire) < new Date() ? "Expired" : formatDate(expire);
  } else {
    expireInfo = "Lifetime";
  }

  $done({
    title: `LIBER | Expire ${expireInfo} | ${formatTime()}`,
    content: `${bytesToSize(used)} Used / Total ${bytesToSize(total)}`,
    icon: "airplane.circle",
    "icon-color": "#FAC858",
  });
})();

function getDataInfo(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url: encodeURI(url), headers: { "User-Agent": "Quantumult%20X" } }, (err, resp) => {
      if (err || resp.status !== 200) return reject(err || resp.status);
      let header = resp.headers["subscription-userinfo"];
      if (header) resolve(Object.fromEntries(header.match(/\w+=[\d.eE+-]+/g).map(item => item.split("=").map((v, i) => i === 1 ? +v : v))));
      else reject("No Data");
    });
  });
}

function bytesToSize(bytes) {
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  if (bytes === 0) return "0";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
}

function formatDate(time) {
  let date = new Date(time);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function formatTime() {
  let now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}