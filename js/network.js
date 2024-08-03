class httpMethod {
  static _httpRequestCallback(resolve, reject, error, response, data) {
    error ? reject(error) : resolve({ ...response, data });
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

function randomString32() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
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

  const radio = $network['cellular-data']?.radio;
  return $network['cellular-data'] && !$network.wifi?.ssid && radio
    ? `Cellular | ${radioGeneration[radio]} - ${radio}`
    : '';
}

function getSSID() {
  return $network.wifi?.ssid || '';
}

function getIP() {
  const { v4, v6 } = $network;
  const protocol = v6?.primaryAddress ? 'IPv4/IPv6 Dual Stack' : 'IPv4 Single Stack';
  const internalIP = v4?.primaryAddress ? `[Internal IP] ${v4.primaryAddress}` : '';
  return `${!v4 && !v6 ? 'Network Error' : `[Protocol] ${protocol}\n${internalIP}`}\n`;
}

async function getNetworkInfo(retryTimes = 5, retryInterval = 1000) {
  while (retryTimes > 0) {
    try {
      const [ipApiResponse, dnsApiResponse] = await Promise.all([
        httpMethod.get('http://ip-api.com/json'),
        httpMethod.get(`http://${randomString32()}.edns.ip-api.com/json`)
      ]);

      if (ipApiResponse.status > 300 || dnsApiResponse.status > 300) {
        throw new Error(`Request error with http status code: ${ipApiResponse.status}\n${ipApiResponse.data}`);
      }

      const ipApiInfo = JSON.parse(ipApiResponse.data);
      const dnsApiInfo = JSON.parse(dnsApiResponse.data).dns;

      $done({
        title: getSSID() ? `Wi-Fi | ${getSSID()}` : getCellularInfo(),
        content: `${getIP()}[Outbound] ${ipApiInfo.query}\n[Provider] ${ipApiInfo.isp}\n[Location] ${ipApiInfo.city}, ${ipApiInfo.country}\n[DNS Leak] ${dnsApiInfo.ip}\n[DNS Geo] ${dnsApiInfo.geo}`,
        icon: getSSID() ? 'wifi' : 'simcard',
        'icon-color': '#73C2FB',
      });

      return;
    } catch (error) {
      if (String(error).startsWith("Network changed")) {
        if (getSSID()) {
          $network.wifi = undefined;
          $network.v4 = undefined;
          $network.v6 = undefined;
        }
      }
      retryTimes--;
      if (retryTimes > 0) {
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
    }
  }

  $done({
    title: 'Error',
    content: 'Network Error',
    icon: 'wifi.exclamationmark',
    'icon-color': '#CB1B45',
  });
}

(() => {
  const retryTimes = 5;
  const retryInterval = 1000;
  const surgeMaxTimeout = 29500;
  const scriptTimeout = Math.min(retryTimes * 5000 + retryTimes * retryInterval, surgeMaxTimeout);

  setTimeout(() => {
    $done({
      title: "Timeout",
      content: "Network Timeout",
      icon: 'wifi.exclamationmark',
      'icon-color': '#CB1B45',
    });
  }, scriptTimeout);

  getNetworkInfo(retryTimes, retryInterval);
})();
