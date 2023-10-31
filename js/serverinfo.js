(async () => {
  let params = getParams($argument);
  let stats = await httpAPI(params.url);
  const jsonData = JSON.parse(stats.body);
  const updateTime = new Date(jsonData.last_time);
  console.log(updateTime);
  updateTime.setHours(updateTime.getHours() + 0);
  const timeString = updateTime.toLocaleString();
  const totalBytes = jsonData.bytes_total;
  const inTraffic = jsonData.bytes_sent;
  const outTraffic = jsonData.bytes_recv;
  const trafficSize = bytesToSize(totalBytes);
  const cpuUsage = `${jsonData.cpu_usage}%`;
  const memUsage = `${jsonData.mem_usage}%`;
  const uptime = `${jsonData.uptime}`;

  let panel = {};
  let shifts = {
    '1': '#06D6A0',
    '2': '#FFD166',
    '3': '#EF476F'
  };
  const col = Diydecide(0, 30, 70, parseInt(jsonData.mem_usage));
  panel.title = params.name || 'Server Info';
  panel.icon = params.icon || 'bolt.horizontal.icloud.fill';
  panel["icon-color"] = shifts[col];
  panel.content = `CPU: ${cpuUsage} | MEM: ${memUsage}\n` +
    `Total: ${trafficSize} [RX: ${bytesToSize(outTraffic)} | TX: ${bytesToSize(inTraffic)}]\n` +
    `Uptime: ${formatUptime(jsonData.uptime)}\n` +
    `Update: ${timeString}`;

  $done(panel);
})().catch((e) => {
  console.log('error: ' + e);
  $done({
    title: 'Error',
    content: `Error ${e}`,
    icon: 'error',
    'icon-color': '#f44336'
  });
});

function httpAPI(path = '') {
  let headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/93.0.4577.63 Mobile/15E148 Safari/604.1 EdgiOS/46.7.4.1'
  };
  return new Promise((resolve, reject) => {
    $httpClient.get({
      url: path,
      headers: headers,
    }, (err, resp, body) => {
      if (err) {
        reject(err);
      } else {
        resp.body = body;
        resp.statusCode = resp.status ? resp.status : resp.statusCode;
        resp.status = resp.statusCode;
        resolve(resp);
      }
    });
  });
}

function getParams(param) {
  return Object.fromEntries(
    $argument
      .split('&')
      .map((item) => item.split('='))
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}

function formatUptime(seconds) {
var days = Math.floor(seconds / (3600 * 24));
var hours = Math.floor((seconds % (3600 * 24)) / 3600);
var minutes = Math.floor((seconds % 3600) / 60);
var result = '';
if (days > 0) {
  result += days + ' day' + (days > 1 ? 's' : '') + ' ';
}
if (hours > 0) {
  result += hours + ' hour' + (hours > 1 ? 's' : '') + ' ';
}
if (minutes > 0 || result === '') {
  result += minutes + ' min' + (minutes > 1 ? 's' : '');
}
return result;
}

function bytesToSize(bytes) {
  if (bytes === 0) return '0 B';
  let k = 1024;
  let sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function Diydecide(x, y, z, item) {
  let array = [x, y, z];
  array.push(item);
  return array.sort((a, b) => a - b).findIndex(i => i === item);
}
