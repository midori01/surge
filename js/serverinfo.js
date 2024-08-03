(async () => {
  try {
    const params = getParams($argument);
    const stats = await httpAPI(params.url);
    const jsonData = JSON.parse(stats.body);
    const updateTime = new Date(jsonData.last_time);
    console.log(updateTime);
    const timeString = updateTime.toLocaleString();
    const totalBytes = jsonData.bytes_total;
    const inTraffic = jsonData.bytes_sent;
    const outTraffic = jsonData.bytes_recv;
    const trafficSize = bytesToSize(totalBytes);
    const cpuUsage = `${jsonData.cpu_usage}%`;
    const memUsage = `${jsonData.mem_usage}%`;
    const uptime = formatUptime(jsonData.uptime);

    const panel = {
      title: params.name || 'ServerInfo',
      icon: params.icon || 'aqi.medium',
      "icon-color": getColorBasedOnMemUsage(parseInt(jsonData.mem_usage)),
      content: `[Usage] CPU ${cpuUsage} | MEM ${memUsage}\n` +
        `[Traffic] RX ${bytesToSize(outTraffic)} | TX ${bytesToSize(inTraffic)}\n` +
        `[Uptime] ${uptime}\n` +
        `[Update] ${timeString}`
    };

    $done(panel);
  } catch (e) {
    console.log('error: ' + e);
    $done({
      title: 'Error',
      content: `Error ${e}`,
      icon: 'error',
      'icon-color': '#F44336'
    });
  }
})();

function httpAPI(path) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/93.0.4577.63 Mobile/15E148 Safari/604.1 EdgiOS/46.7.4.1'
  };
  return new Promise((resolve, reject) => {
    $httpClient.get({ url: path, headers }, (err, resp, body) => {
      if (err) {
        reject(err);
      } else {
        resp.body = body;
        resolve(resp);
      }
    });
  });
}

function getParams(param) {
  return Object.fromEntries(new URLSearchParams($argument).entries());
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  let result = '';
  if (days > 0) result += `${days} day${days > 1 ? 's' : ''} `;
  if (hours > 0) result += `${hours} hour${hours > 1 ? 's' : ''} `;
  if (minutes > 0 || result === '') result += `${minutes} min${minutes > 1 ? 's' : ''}`;
  return result;
}

function bytesToSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function getColorBasedOnMemUsage(memUsage) {
  if (memUsage < 30) return '#06D6A0';
  if (memUsage < 70) return '#FFD166';
  return '#EF476F';
}
