class httpMethod {
  static _httpRequestCallback(resolve, reject, error, response, data) {
    error ? reject(error) : resolve({ ...response, data });
  }

  static request(method, option = {}) {
    return new Promise((resolve, reject) => {
      $httpClient[method](option, (error, response, data) => {
        this._httpRequestCallback(resolve, reject, error, response, data);
      });
    });
  }

  static get(option = {}) {
    return this.request('get', option);
  }

  static post(option = {}) {
    return this.request('post', option);
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

function getSTUNIP() {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.createDataChannel('');
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(() => resolve(''));

    pc.onicecandidate = (ice) => {
      if (ice && ice.candidate && ice.candidate.candidate) {
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        const ip = ipRegex.exec(ice.candidate.candidate);
        if (ip) {
          resolve(ip[1]);
          pc.close();
        }
      }
    };

    setTimeout(() => {
      resolve('');
      pc.close();
    }, 1000);
  });
}

async function getNetworkInfo(retryTimes = 5, retryInterval = 1000) {
  const checkStatus = (response) => {
    if (response.status > 300) {
      throw new Error(`Request error with HTTP status code: ${response.status}\n${response.data}`);
    }
    return response;
  };

  while (retryTimes > 0) {
    try {
      const [ipApiResponse, dnsApiResponse, stunIP] = await Promise.all([
        httpMethod.get('http://208.95.112.1/json'),
        httpMethod.get(`http://${randomString32()}.edns.ip-api.com/json`),
        Promise.race([
          getSTUNIP(),
          new Promise(resolve => setTimeout(() => resolve(''), 1000))
        ])
      ]);

      checkStatus(ipApiResponse);
      checkStatus(dnsApiResponse);

      const ipApiInfo = JSON.parse(ipApiResponse.data);
      const dnsApiInfo = JSON.parse(dnsApiResponse.data).dns;

      $done({
        title: getSSID() ? `Wi-Fi | ${getSSID()}` : getCellularInfo(),
        content: `${getIP()}[Outbound] ${ipApiInfo.query}\n[Provider] ${ipApiInfo.as}\n[Location] ${ipApiInfo.city}, ${ipApiInfo.country}\n[WebRTC] ${stunIP || 'N/A'}\n[DNS Leak] ${dnsApiInfo.ip}\n[Leak Geo] ${dnsApiInfo.geo})`,
        icon: getSSID() ? 'wifi' : 'simcard',
        'icon-color': '#73C2FB',
      });

      return;
    } catch (error) {
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

  const timeoutHandle = setTimeout(() => {
    $done({
      title: "Timeout",
      content: "Network Timeout",
      icon: 'wifi.exclamationmark',
      'icon-color': '#CB1B45',
    });
  }, scriptTimeout);

  getNetworkInfo(retryTimes, retryInterval).finally(() => clearTimeout(timeoutHandle));
})();
