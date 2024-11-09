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

function getCurrentTimestamp() {
  const now = new Date();
  return now.toTimeString().slice(0, 5);
}

function getProtocolType() {
  return $network.v6?.primaryAddress ? 'Dual-Stack' : 'Single-Stack';
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
    ? `${radioGeneration[radio]} ${radio} | ${getProtocolType()} | ${getCurrentTimestamp()}`
    : '';
}

function getSSID() {
  const ssid = $network.wifi?.ssid || '';
  return ssid ? `${ssid} | ${getProtocolType()} | ${getCurrentTimestamp()}` : '';
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
  return 'N/A';
}

async function fetchNetworkData() {
  const ipApiResponse = await httpMethod.get('http://208.95.112.1/json');
  const dnsApiResponse = await httpMethod.get(`http://${randomString32()}.edns.ip-api.com/json`);

  return { ipApiResponse, dnsApiResponse };
}

async function getNetworkInfo(retryTimes = 5, retryInterval = 1000) {
  const checkStatus = (response) => {
    if (response.status > 300) {
      throw new Error(`Request error with HTTP status code: ${response.status}\n${response.data}`);
    }
    return response;
  };

  const dnsGeoMap = {
    "Sony Network": "Japan - Sony Network",
    "China Mobile": "China - China Mobile",
    "China Unicom": "China - China Unicom",
    "China Telecom": "China - China Telecom"
  };

  while (retryTimes > 0) {
    try {
      const { ipApiResponse, dnsApiResponse } = await fetchNetworkData();

      checkStatus(ipApiResponse);
      checkStatus(dnsApiResponse);

      const ipApiInfo = JSON.parse(ipApiResponse.data);
      const hostname = await resolveHostname(ipApiInfo.query);
      const dnsApiInfo = JSON.parse(dnsApiResponse.data).dns;
      const geoCountry = dnsApiInfo.geo.split(' - ')[0].trim().toLowerCase();
      const ipCountry = ipApiInfo.country.trim().toLowerCase();

      let dnsLeakInfo;
      if (geoCountry === ipCountry) {
        dnsLeakInfo = "Congratulations! Unleak";
      } else {
        const matchedKey = Object.keys(dnsGeoMap).find(key => dnsApiInfo.geo.toLowerCase().includes(key.toLowerCase()));
        dnsLeakInfo = matchedKey ? dnsGeoMap[matchedKey] : dnsApiInfo.geo;
      }

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
      } else if (ipApiInfo.countryCode === 'KR') {
        let city = ipApiInfo.city;
        if (city.includes('-')) {
          city = city.split('-')[0];
        }
        location = `${city}, ${ipApiInfo.country}`;
      } else {
        location = `${ipApiInfo.city}, ${ipApiInfo.country}`;
      }

      $done({
        title: getSSID() ? `${getSSID()}` : getCellularInfo(),
        content: `IP Address: ${ipApiInfo.query}\nPTR: ${hostname}\nISP: ${ipApiInfo.as}\nLocation: ${location}\nDNS Leak: ${dnsLeakInfo}`,
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