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
  return 'Lookup Failed: NXDOMAIN';
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
    "Japan - NTT": "Japan - NTT Corp",
    "Japan - KDDI": "Japan - KDDI Corp.",
    "Japan - SoftBank": "Japan - SoftBank Corp.",
    "Japan - Rakuten": "Japan - Rakuten Inc.",
    "Japan - BIGLOBE": "Japan - BIGLOBE Inc.",
    "Japan - Internet Initiative Japan": "Japan - IIJ Inc.",
    "Japan - ARTERIA": "Japan - ARTERIA Corp.",
    "Japan - So-net": "Japan - So-net Corp.",
    "Japan - Sony Network": "Japan - So-net Corp.",
    "Japan - Oracle": "Japan - Oracle",
    "Japan - Amazon": "Japan - Amazon",
    "Japan - Microsoft": "Japan - Microsoft",
    "Japan - Alibaba": "Japan - Alibaba",
    "Japan - Tencent": "Japan - Tencent",
    "Japan - Google": "Japan - Google",
    "Japan - Cloudflare": "Japan - Cloudflare",
    "South Korea - Oracle": "South Korea - Oracle",
    "South Korea - Amazon": "South Korea - Amazon",
    "South Korea - Microsoft": "South Korea - Microsoft",
    "South Korea - Alibaba": "South Korea - Alibaba",
    "South Korea - Tencent": "South Korea - Tencent",
    "South Korea - Google": "South Korea - Google",
    "South Korea - Cloudflare": "South Korea - Cloudflare",
    "Singapore - Oracle": "Singapore - Oracle",
    "Singapore - Amazon": "Singapore - Amazon",
    "Singapore - Microsoft": "Singapore - Microsoft",
    "Singapore - Alibaba": "Singapore - Alibaba",
    "Singapore - Tencent": "Singapore - Tencent",
    "Singapore - Google": "Singapore - Google",
    "Singapore - Cloudflare": "Singapore - Cloudflare",
    "Taiwan - Oracle": "Taiwan - Oracle",
    "Taiwan - Amazon": "Taiwan - Amazon",
    "Taiwan - Microsoft": "Taiwan - Microsoft",
    "Taiwan - Alibaba": "Taiwan - Alibaba",
    "Taiwan - Tencent": "Taiwan - Tencent",
    "Taiwan - Google": "Taiwan - Google",
    "Taiwan - Cloudflare": "Taiwan - Cloudflare",
    "Hong Kong - Oracle": "Hong Kong - Oracle",
    "Hong Kong - Amazon": "Hong Kong - Amazon",
    "Hong Kong - Microsoft": "Hong Kong - Microsoft",
    "Hong Kong - Alibaba": "Hong Kong - Alibaba",
    "Hong Kong - Tencent": "Hong Kong - Tencent",
    "Hong Kong - Google": "Hong Kong - Google",
    "Hong Kong - Cloudflare": "Hong Kong - Cloudflare",
    "United States - Oracle": "United States - Oracle",
    "United States - Amazon": "United States - Amazon",
    "United States - Microsoft": "United States - Microsoft",
    "United States - Alibaba": "United States - Alibaba",
    "United States - Tencent": "United States - Tencent",
    "United States - Google": "United States - Google",
    "United States - Cloudflare": "United States - Cloudflare",
    "Canada - Oracle": "Canada - Oracle",
    "Canada - Amazon": "Canada - Amazon",
    "Canada - Microsoft": "Canada - Microsoft",
    "Canada - Alibaba": "Canada - Alibaba",
    "Canada - Tencent": "Canada - Tencent",
    "Canada - Google": "Canada - Google",
    "Canada - Cloudflare": "Canada - Cloudflare",
    "United Kingdom - Oracle": "United Kingdom - Oracle",
    "United Kingdom - Amazon": "United Kingdom - Amazon",
    "United Kingdom - Microsoft": "United Kingdom - Microsoft",
    "United Kingdom - Alibaba": "United Kingdom - Alibaba",
    "United Kingdom - Tencent": "United Kingdom - Tencent",
    "United Kingdom - Google": "United Kingdom - Google",
    "United Kingdom - Cloudflare": "United Kingdom - Cloudflare",
    "Germany - Oracle": "Germany - Oracle",
    "Germany - Amazon": "Germany - Amazon",
    "Germany - Microsoft": "Germany - Microsoft",
    "Germany - Alibaba": "Germany - Alibaba",
    "Germany - Tencent": "Germany - Tencent",
    "Germany - Google": "Germany - Google",
    "Germany - Cloudflare": "Germany - Cloudflare",
    "Netherlands - Oracle": "Netherlands - Oracle",
    "Netherlands - Amazon": "Netherlands - Amazon",
    "Netherlands - Microsoft": "Netherlands - Microsoft",
    "Netherlands - Alibaba": "Netherlands - Alibaba",
    "Netherlands - Tencent": "Netherlands - Tencent",
    "Netherlands - Google": "Netherlands - Google",
    "Netherlands - Cloudflare": "Netherlands - Cloudflare",
    "China - China Mobile": "China - China Mobile",
    "China - China Unicom": "China - China Unicom",
    "China - China Telecom": "China - China Telecom",
    "China - China Broadband": "China - China Broadband"
  };

  while (retryTimes > 0) {
    try {
      const { ipApiResponse, dnsApiResponse } = await fetchNetworkData();

      checkStatus(ipApiResponse);
      checkStatus(dnsApiResponse);

      const ipApiInfo = JSON.parse(ipApiResponse.data);
      const hostname = await resolveHostname(ipApiInfo.query);
      const dnsApiInfo = JSON.parse(dnsApiResponse.data).dns;

      let dnsLeakInfo;
      const matchedKey = Object.keys(dnsGeoMap).find(key => dnsApiInfo.geo.toLowerCase().includes(key.toLowerCase()));
      dnsLeakInfo = matchedKey ? dnsGeoMap[matchedKey] : dnsApiInfo.geo;

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