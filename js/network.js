class httpMethod {

  static _httpRequestCallback(resolve, reject, error, response, data) {
    if (error) {
      reject(error);
    } else {
      resolve(Object.assign(response, { data }));
    }
  }

  static get(option = {}) {
    return new Promise((resolve, reject) => {
      $httpClient.get(option, (error, response, data) => {
        this._httpRequestCallback(resolve, reject, error, response, data);
      });
    });
  }

  static post(option = {}) {
    return new Promise((resolve, reject) => {
      $httpClient.post(option, (error, response, data) => {
        this._httpRequestCallback(resolve, reject, error, response, data);
      });
    });
  }
}

class loggerUtil {
  constructor() {
    this.id = randomString();
  }

  log(message) {
    message = `[${this.id}] [ LOG ] ${message}`;
    console.log(message);
  }

  error(message) {
    message = `[${this.id}] [ERROR] ${message}`;
    console.log(message);
  }
}

var logger = new loggerUtil();

function randomString(e = 6) {
  var t = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678",
    a = t.length,
    n = "";
  for (i = 0; i < e; i++) n += t.charAt(Math.floor(Math.random() * a));
  return n;
}

function getCellularInfo() {
  const radioGeneration = {
    'GPRS': '2.5G',
    'CDMA1x': '2.5G',
    'EDGE': '2.75G',
    'WCDMA': '3G',
    'HSDPA': '3.5G',
    'CDMAEVDORev0': '3.5G',
    'CDMAEVDORevA': '3.5G',
    'CDMAEVDORevB': '3.75G',
    'HSUPA': '3.75G',
    'eHRPD': '3.9G',
    'LTE': '4G',
    'NRNSA': '5G',
    'NR': '5G',
  };

  let cellularInfo = '';
  if ($network['cellular-data']) {
    const radio = $network['cellular-data'].radio;
    if ($network.wifi?.ssid == null && radio) {
      cellularInfo = `Cellular | ${radioGeneration[radio]} - ${radio}`;
    }
  }
  return cellularInfo;
}

function getSSID() {
  return $network.wifi?.ssid;
}

function getIP() {
  const { v4, v6 } = $network;
  let info = [];
  if (!v4 && !v6) {
    info = ['Network Error'];
  } else {
    if (v6?.primaryAddress) {
      info.push(`[Protocol] IPv4/IPv6 Dual Stack`);
    } else {
      info.push(`[Protocol] IPv4 Single Stack`);
    }
    if (v4?.primaryAddress) info.push(`[Internal IP] ${v4?.primaryAddress}`);
  }
  info = info.join("\n");
  return info + "\n";
}

function getNetworkInfo(retryTimes = 5, retryInterval = 1000) {
  Promise.all([
    httpMethod.get('http://ip-api.com/json'),
    httpMethod.get('http://h0lmeytuf53au1u1bhw4xymwyqos03co.edns.ip-api.com/json')
  ])
  .then(responses => {
    const [ipApiResponse, dnsApiResponse] = responses;

    if (Number(ipApiResponse.status) > 300) {
      throw new Error(`Request error with http status code: ${ipApiResponse.status}\n${ipApiResponse.data}`);
    }

    if (Number(dnsApiResponse.status) > 300) {
      throw new Error(`Request error with http status code: ${dnsApiResponse.status}\n${dnsApiResponse.data}`);
    }

    const ipApiInfo = JSON.parse(ipApiResponse.data);
    const dnsApiInfo = JSON.parse(dnsApiResponse.data).dns;

    $done({
      title: getSSID() ? `Wi-Fi | ${getSSID()}` : getCellularInfo(),
      content:
        getIP() +
        `[Outbound] ${ipApiInfo.query}\n` +
        `[Provider] ${ipApiInfo.isp}\n` +
        `[Location] ${ipApiInfo.city}, ${ipApiInfo.country}\n` +
        `[DNS Leak] ${dnsApiInfo.ip}\n` +
        `[DNS Geo] ${dnsApiInfo.geo}`,
      icon: getSSID() ? 'wifi' : 'simcard',
      'icon-color': getSSID() ? '#73C2FB' : '#73C2FB',
    });
  })
  .catch(error => {
    if (String(error).startsWith("Network changed")) {
      if (getSSID()) {
        $network.wifi = undefined;
        $network.v4 = undefined;
        $network.v6 = undefined;
      }
    }
    if (retryTimes > 0) {
      logger.error(error);
      logger.log(`Retry after ${retryInterval}ms`);
      setTimeout(() => getNetworkInfo(--retryTimes, retryInterval), retryInterval);
    } else {
      logger.error(error);
      $done({
        title: 'Error',
        content: 'Network Error',
        icon: 'wifi.exclamationmark',
        'icon-color': '#CB1B45',
      });
    }
  });
}

(() => {
  const retryTimes = 5;
  const retryInterval = 1000;
  const surgeMaxTimeout = 29500;
  const scriptTimeout = retryTimes * 5000 + retryTimes * retryInterval;
  setTimeout(() => {
    logger.log("Script timeout");
    $done({
      title: "Timeout",
      content: "Network Timeout",
      icon: 'wifi.exclamationmark',
      'icon-color': '#CB1B45',
    });
  }, scriptTimeout > surgeMaxTimeout ? surgeMaxTimeout : scriptTimeout);

  logger.log("Script start");
  getNetworkInfo(retryTimes, retryInterval);
})();
