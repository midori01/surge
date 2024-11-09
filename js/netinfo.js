class httpMethod {
  static request(method, option = {}) {
    return new Promise((resolve, reject) => {
      $httpClient[method](option, (error, response, data) => {
        error ? reject(error) : resolve({ ...response, data });
      });
    });
  }

  static get(option = {}) {
    return this.request('get', option);
  }
}

function randomString32() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

function getTimestamp() {
  return new Date().toTimeString().slice(0, 5);
}

function getProtocolType() {
  return $network.v6?.primaryAddress ? 'Dual-Stack' : 'Single-Stack';
}

function getNetworkInfoType() {
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
    'NR': '5G'
  };

  const wifiSSID = $network.wifi?.ssid;
  const radio = $network['cellular-data']?.radio;
  if (wifiSSID) return { type: 'WiFi', info: wifiSSID };
  if (radio) return { type: 'Cellular', info: `${radioGeneration[radio] || ''} ${radio}`.trim() };
  return { type: 'Unknown', info: '' };
}

async function resolveHostname(ip) {
  const reverseDNS = ip.split('.').reverse().join('.') + '.in-addr.arpa';
  try {
    const response = await httpMethod.get(`http://223.5.5.5/resolve?name=${reverseDNS}&type=PTR`);
    const data = JSON.parse(response.data);
    return data?.Answer?.[0]?.data || 'Lookup Failed: NXDOMAIN';
  } catch (error) {
    console.error('Error resolving hostname:', error);
    return 'Lookup Failed: NXDOMAIN';
  }
}

async function fetchNetworkData() {
  return Promise.all([
    httpMethod.get('http://208.95.112.1/json'),
    httpMethod.get(`http://${randomString32()}.edns.ip-api.com/json`)
  ]);
}

async function retryOperation(fn, retries, delay) {
  let attempts = 0;
  while (attempts < retries) {
    try {
      return await fn();
    } catch (error) {
      attempts++;
      if (attempts < retries) {
        console.warn(`Retrying... Attempt ${attempts}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

async function getNetworkInfo(retryTimes = 5, retryInterval = 1000) {
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

  const locationMap = {
    'JP': (info) => (info.regionName === 'Tokyo' && info.city === 'Tokyo') 
          ? `${info.regionName}, ${info.country}`
          : `${info.city}, ${info.regionName}, ${info.country}`,
    'CN': (info) => ['Beijing', 'Shanghai', 'Tianjin', 'Chongqing'].includes(info.regionName) 
          ? `${info.regionName}, PRC` 
          : `${info.city}, ${info.regionName}, PRC`,
    'TW': (info) => /Taipei/.test(info.city) ? `Taipei, ROC (${info.country})` : `${info.city}, ROC (${info.country})`,
    'DE': (info) => /Frankfurt/.test(info.city) ? `Frankfurt, ${info.country}` : `${info.city}, ${info.country}`,
    'ZA': (info) => /Johannesburg/.test(info.city) ? `Jo'burg, ${info.country}` : `${info.city}, ${info.country}`,
    'KR': (info) => `${info.city.split('-')[0]}, ${info.country}`,
    'US': (info) => `${info.city}, ${info.region}, USA`,
    'GU': (info) => `${info.city}, ${info.country} (US)`,
    'CA': (info) => `${info.city}, ${info.region}, ${info.country}`,
    'GB': (info) => `${info.city}, ${info.regionName}, UK`,
    'AE': (info) => `${info.city}, ${info.region}, UAE`,
    'HK': (info) => `${info.country} SAR, PRC`,
    'MO': (info) => `${info.country} SAR, PRC`,
    'SG': (info) => `${info.country} (${info.countryCode})`,
    'VA': (info) => `${info.country} (${info.countryCode})`,
    'MC': (info) => `${info.country} (${info.countryCode})`,
    'GI': (info) => `${info.country} (${info.countryCode})`,
    'default': (info) => `${info.city}, ${info.country}`
  };

  while (retryTimes > 0) {
    try {
      const [ipApiResponse, dnsApiResponse] = await retryOperation(fetchNetworkData, retryTimes, retryInterval);
      if (ipApiResponse.status > 300) throw new Error(`HTTP status code: ${ipApiResponse.status}`);
      if (dnsApiResponse.status > 300) throw new Error(`HTTP status code: ${dnsApiResponse.status}`);    
      const infoType = getNetworkInfoType();
      const title = `${infoType.info} | ${getProtocolType()} | ${getTimestamp()}`;  
      const ipInfo = JSON.parse(ipApiResponse.data);
      const hostname = await resolveHostname(ipInfo.query);
      const dnsGeo = JSON.parse(dnsApiResponse.data).dns.geo;    
      let dnsLeakInfo = Object.keys(dnsGeoMap).find(keyword => dnsGeo.toLowerCase().includes(keyword.toLowerCase())) 
        ? dnsGeoMap[Object.keys(dnsGeoMap).find(keyword => dnsGeo.toLowerCase().includes(keyword.toLowerCase()))] 
        : dnsGeo;
      const location = locationMap[ipInfo.countryCode] 
        ? locationMap[ipInfo.countryCode](ipInfo) 
        : locationMap['default'](ipInfo);

      $done({
        title,
        content: `IP Address: ${ipInfo.query}\nPTR: ${hostname}\nISP: ${ipInfo.as}\nLocation: ${location}\nDNS Leak: ${dnsLeakInfo}`,
        icon: infoType.type === 'WiFi' ? 'wifi' : 'simcard',
        'icon-color': '#73C2FB',
      });
      return;
    } catch (error) {
      console.error(`Attempt failed, retries left: ${retryTimes - 1}`, error);
      retryTimes--;
      if (retryTimes > 0) await new Promise(resolve => setTimeout(resolve, retryInterval));
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
  const timeoutHandle = setTimeout(() => {
    $done({
      title: "Timeout",
      content: "Network Timeout",
      icon: 'wifi.exclamationmark',
      'icon-color': '#CB1B45',
    });
  }, 29500);
  
  getNetworkInfo().finally(() => clearTimeout(timeoutHandle));
})();