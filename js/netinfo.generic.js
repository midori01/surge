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
    "NTT": "NTT Corp",
    "KDDI": "KDDI Corp.",
    "SoftBank": "SoftBank Corp.",
    "Rakuten": "Rakuten Inc.",
    "BIGLOBE": "BIGLOBE Inc.",
    "Internet Initiative Japan": "IIJ Inc.",
    "ARTERIA": "ARTERIA Corp.",
    "So-net": "So-net Corp.",
    "Sony Network": "So-net Corp.",
    "Oracle": "Oracle", "Amazon": "Amazon",
    "Microsoft": "Microsoft",
    "Alibaba": "Alibaba",
    "Tencent": "Tencent",
    "Google": "Google",
    "Cloudflare": "Cloudflare",
    "China Mobile": "China Mobile",
    "CHINAMOBILE": "China Mobile",
    "CMNET": "China Mobile",
    "China Unicom": "China Unicom",
    "CHINAUNICOM": "China Unicom",
    "CHINA169": "China Unicom",
    "China Telecom": "China Telecom",
    "CHINANET": "China Telecom",
    "China Broadnet": "China Broadnet",
    "China Cable": "China Broadnet",
    "CBNET": "China Broadnet",
    "China Education": "CERNET",
    "CERNET": "CERNET"
  };

  const locationMap = {
    'JP': (info) => (info.regionName === 'Tokyo' && info.city === 'Tokyo') 
      ? `${info.regionName}, ${info.country}` : `${info.city}, ${info.regionName}, ${info.country}`,
    'CN': (info) => ['Beijing', 'Shanghai', 'Tianjin', 'Chongqing'].includes(info.regionName) 
      ? `${info.regionName}, PRC` : `${info.city}, ${info.regionName}, PRC`,
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

  while (retryTimes-- > 0) {
    try {
      const [ipApiResponse, dnsApiResponse] = await retryOperation(fetchNetworkData, retryTimes, retryInterval);
      if (ipApiResponse.status > 300 || dnsApiResponse.status > 300) throw new Error("API Error");
      const ipInfo = JSON.parse(ipApiResponse.data);
      const hostname = await resolveHostname(ipInfo.query);
      const dnsGeo = JSON.parse(dnsApiResponse.data).dns.geo;
      const [country, keyword] = dnsGeo.split(" - ");
      const keywordMatch = Object.keys(dnsGeoMap).find(key => keyword.toLowerCase().includes(key.toLowerCase()));
      const mappedDnsGeo = `${country} - ${dnsGeoMap[keywordMatch] || keyword}`;
      const location = (locationMap[ipInfo.countryCode] || locationMap['default'])(ipInfo);

      $done({
        title: `${getNetworkInfoType().info} | ${getProtocolType()} | ${getTimestamp()}`,
        content: `IP Address: ${ipInfo.query}\nPTR: ${hostname}\nISP: ${ipInfo.as}\nLocation: ${location}\nDNS Leak: ${mappedDnsGeo}`,
        icon: getNetworkInfoType().type === 'WiFi' ? 'wifi' : 'simcard',
        'icon-color': '#73C2FB',
      });
      return;
    } catch (error) {
      console.error(`Attempt failed, retries left: ${retryTimes}`, error);
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
