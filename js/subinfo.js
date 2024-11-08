let args = getArgs();

(async () => {
  let info = await getDataInfo(args.url);
  if (!info) $done();
  
  let resetDayLeft = getRemainingDays();
  let used = info.download + info.upload;
  let total = info.total;
  let expire = args.expire || info.expire;
  let content = [`Usage: ${bytesToSize(used)} | ${bytesToSize(total)}`];

  if (resetDayLeft > 0) {
    content.push(`Reset: ${resetDayLeft} days later`);
  } else {
    content.push("Reset: Today");
  }

  if (expire && expire !== "false") {
    if (/^[\d.]+$/.test(expire)) expire *= 1000;
    content.push(`Expire: ${formatTime(expire)}`);
  }

  let now = new Date();
  let hour = now.getHours().toString().padStart(2, '0');
  let minutes = now.getMinutes().toString().padStart(2, '0');
  let currentTime = `${hour}:${minutes}`;

  $done({
    title: `${args.title || 'LIBER'} | ${currentTime}`,
    content: content.join("\n"),
    icon: args.icon || "airplane.circle",
    "icon-color": args.color || "#FAC858",
  });
})();

function getArgs() {
  return Object.fromEntries(new URLSearchParams($argument));
}

function getUserInfo(url) {
  let request = { headers: { "User-Agent": "Quantumult%20X" }, url };
  return new Promise((resolve, reject) =>
    $httpClient.get(request, (err, resp) => {
      if (err || resp.status !== 200) {
        reject(err || resp.status);
        return;
      }
      let header = Object.keys(resp.headers).find(
        (key) => key.toLowerCase() === "subscription-userinfo"
      );
      if (header) {
        resolve(resp.headers[header]);
        return;
      }
      reject("No Data");
    })
  );
}

async function getDataInfo(url) {
  const [err, data] = await getUserInfo(url)
    .then((data) => [null, data])
    .catch((err) => [err, null]);
  if (err) {
    console.log(err);
    return;
  }

  return Object.fromEntries(
    data
      .match(/\w+=[\d.eE+-]+/g)
      .map((item) => item.split("="))
      .map(([k, v]) => [k, Number(v)])
  );
}

function getRemainingDays() {
  let now = new Date();
  let today = now.getDate();
  let resetDay = 1;
  let daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  return today < resetDay
    ? resetDay - today
    : today === resetDay
    ? 0
    : daysInMonth - today + resetDay;
}

function bytesToSize(bytes) {
  if (bytes === 0) return "0";
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
}

function formatTime(time) {
  return new Date(time).toLocaleDateString();
}