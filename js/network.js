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
  const protocol = v6?.primaryAddress ? '[IP Version] IPv4 & IPv6' : '[IP Version] IPv4 Only';
  const internalIP = v4?.primaryAddress ? `[Internal IP] ${v4.primaryAddress}` : '';
  return `${!v4 && !v6 ? 'Network Error' : `${protocol}\n${internalIP}`}\n`;
}

function getSTUNIP() {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.createDataChannel('');
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(() => resolve({ ip: '', port: '' }));

    pc.onicecandidate = (ice) => {
      if (ice && ice.candidate && ice.candidate.candidate) {
        const candidate = ice.candidate.candidate;
        const ipPortV4Regex = /candidate:\d+\s\d+\sudp\s\d+\s([0-9]{1,3}(\.[0-9]{1,3}){3})\s(\d+)/i;
        const ipPortV6Regex = /candidate:\d+\s\d+\sudp\s\d+\s([a-fA-F0-9:.]+)\s(\d+)/i;

        let ipPortMatch = ipPortV4Regex.exec(candidate) || ipPortV6Regex.exec(candidate);
        
        if (ipPortMatch) {
          let ip = ipPortMatch[1];
          const port = ipPortMatch[3] || ipPortMatch[2];
          if (ip.includes(':')) {
            ip = `[${ip}]`;
          }
          resolve({ ip, port });
          pc.close();
        }
      }
    };

    setTimeout(() => {
      resolve({ ip: '', port: '' });
      pc.close();
    }, 2000);
  });
}

function getCurrentTimestamp() {
  const now = new Date();
  return `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
}

async function resolveHostname(ip) {
  const ipToReverseDNS = (ip) => {
    return ip.split('.').reverse().join('.') + '.in-addr.arpa';
  };

  const reverseDNS = ipToReverseDNS(ip);

  try {
    const response = await httpMethod.get(`http://223.5.5.5/resolve?name=${reverseDNS}&type=PTR`);
    const data = JSON.parse(response.data);
    if (data && data.Answer && data.Answer.length > 0) {
      return data.Answer[0].data;
    }
  } catch (error) {
    console.error('Error resolving hostname:', error);
  }
  return 'Reverse DNS Not Found';
}

async function fetchNetworkData() {
  const [ipApiResponse, dnsApiResponse, stunResult] = await Promise.all([
    httpMethod.get('http://208.95.112.1/json'),
    httpMethod.get(`http://${randomString32()}.edns.ip-api.com/json`),
    Promise.race([
      getSTUNIP(),
      new Promise(resolve => setTimeout(() => resolve({ ip: '', port: '' }), 1000))
    ])
  ]);

  return { ipApiResponse, dnsApiResponse, stunResult };
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
      const { ipApiResponse, dnsApiResponse, stunResult } = await fetchNetworkData();

      checkStatus(ipApiResponse);
      checkStatus(dnsApiResponse);

      const ipApiInfo = JSON.parse(ipApiResponse.data);
      const dnsApiInfo = JSON.parse(dnsApiResponse.data).dns;

      const dnsGeoCountry = dnsApiInfo.geo.split(' - ')[0];
      const dnsLeakInfo = dnsGeoCountry === ipApiInfo.country
        ? `${dnsApiInfo.ip} - N/A`
        : `${dnsApiInfo.ip} - ${dnsGeoCountry}`;

      const stunInfo = stunResult.ip ? `${stunResult.ip}:${stunResult.port}` : 'N/A (STUN Timeout)';
      const hostname = await resolveHostname(ipApiInfo.query);
      const timestamp = getCurrentTimestamp();

      let location;
      if (ipApiInfo.countryCode === 'GB') {
        location = `${ipApiInfo.city}, ${ipApiInfo.regionName}, UK`;
      } else if (ipApiInfo.countryCode === 'AE') {
        location = `${ipApiInfo.city}, ${ipApiInfo.region}, UAE`;
      } else if (ipApiInfo.city === 'Johannesburg') {
        location = `Joburg, ${ipApiInfo.country}`;
      } else if (ipApiInfo.city === 'Frankfurt am Main') {
        location = `Frankfurt, ${ipApiInfo.country}`;
      } else if (ipApiInfo.countryCode === 'TW') {
        const isTaipei = /Taipei/.test(ipApiInfo.regionName) || /Taipei/.test(ipApiInfo.city);
        location = isTaipei ? `Taipei, ROC (${ipApiInfo.country})` : `${ipApiInfo.city}, ROC (${ipApiInfo.country})`;
      } else if (ipApiInfo.countryCode === 'CN') {
        if (['Beijing', 'Shanghai', 'Tianjin', 'Chongqing'].includes(ipApiInfo.regionName)) {
          location = `${ipApiInfo.regionName}, P.R. China`;
        } else {
          location = `${ipApiInfo.city}, ${ipApiInfo.regionName}, PRC`;
        }
      } else if (ipApiInfo.countryCode === 'JP') {
        if (ipApiInfo.regionName === 'Tokyo' && ipApiInfo.city === 'Tokyo') {
          location = `${ipApiInfo.regionName}, ${ipApiInfo.country}`;
        } else {
          location = `${ipApiInfo.city}, ${ipApiInfo.regionName}, ${ipApiInfo.country}`;
        }
      } else if (ipApiInfo.countryCode === 'US') {
        location = `${ipApiInfo.city}, ${ipApiInfo.region}, USA`;
      } else if (ipApiInfo.countryCode === 'CA') {
        location = `${ipApiInfo.city}, ${ipApiInfo.region}, ${ipApiInfo.country}`;
      } else if (['HK', 'MO'].includes(ipApiInfo.countryCode)) {
        location = `${ipApiInfo.country} SAR, PRC`;
      } else if (['SG', 'VA', 'MC', 'GI'].includes(ipApiInfo.countryCode)) {
        location = `${ipApiInfo.country} (${ipApiInfo.countryCode})`;
      } else {
        location = `${ipApiInfo.city}, ${ipApiInfo.country}`;
      }

      $done({
        title: getSSID() ? `Wi-Fi | ${getSSID()}` : getCellularInfo(),
        content: `${getIP()}[Outbound] ${ipApiInfo.query}\n[PTR] ${hostname}\n[ISP] ${ipApiInfo.as}\n[Location] ${location}\n[WebRTC] ${stunInfo}\n[DNS Leak] ${dnsLeakInfo}\n[Timestamp] ${timestamp}`,
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
