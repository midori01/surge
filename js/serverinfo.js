(async () => {
  try {
    const params = getParams();
    const url = params.url || 'http://127.0.0.1:7122';
    const stats = await httpAPI(url);
    const jsonData = JSON.parse(stats.body);
    const updateTime = new Date();
    const hours = updateTime.getHours().toString().padStart(2, '0');
    const minutes = updateTime.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    const totalBytes = jsonData.bytes_total || 0;
    const inTraffic = jsonData.bytes_sent || 0;
    const outTraffic = jsonData.bytes_recv || 0;
    const cpuUsage = `${jsonData.cpu_usage || 0}%`;
    const memUsage = `${jsonData.mem_usage || 0}%`;
    const trafficSize = bytesToSize(totalBytes);
    const uptime = formatUptime(jsonData.uptime);
    const hostname = jsonData.hostname;

    const panel = {
      title: params.name || `${hostname} | ${timeString}`,
      icon: params.icon || 'aqi.medium',
      "icon-color": getColorBasedOnMemUsage(parseInt(jsonData.mem_usage)),
      content: `Usage: CPU ${cpuUsage} | MEM ${memUsage}\nTraffic: RX ${bytesToSize(outTraffic)} | TX ${bytesToSize(inTraffic)}\nUptime: ${uptime}`
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
  return new Promise((resolve, reject) => {
    $httpClient.get({ url: path }, (err, resp, body) => {
      if (err) {
        reject(err);
      } else {
        resp.body = body;
        resolve(resp);
      }
    });
  });
}

function getParams() {
  try {
    return Object.fromEntries(new URLSearchParams($argument).entries());
  } catch (e) {
    return {};
  }
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