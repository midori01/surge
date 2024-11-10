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
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(array).map(byte => chars[byte % chars.length]).join('');
}

function getTimestamp() {
  return new Date().toTimeString().slice(0, 5);
}

function getProtocolType() {
  return $network.v6?.primaryAddress ? 'Dual Stack' : 'IPv4 Only';
}

function getNetworkInfoType() {
  const wifiSSID = $network.wifi?.ssid;
  if (wifiSSID) return { type: 'WiFi', info: wifiSSID };
  const radio = $network['cellular-data']?.radio;
  const radioGeneration = {
    'GPRS': '2G',
    'Edge': '2G',
    'WCDMA': '3G',
    'HSDPA': '3G',
    'HSUPA': '3G',
    'CDMA1x': '2G',
    'CDMAEVDORev0': '3G',
    'CDMAEVDORevA': '3G',
    'CDMAEVDORevB': '3G',
    'eHRPD': '3G',
    'HRPD': '3G',
    'LTE': '4G',
    'NRNSA': '5G',
    'NR': '5G'
  };
  return { type: 'Cellular', info: `${radioGeneration[radio] || ''} ${radio}`.trim() };
}

async function resolveHostname(ip) {
  const reverseDNS = ip.split('.').reverse().join('.') + '.in-addr.arpa';
  const response = await httpMethod.get(`http://223.5.5.5/resolve?name=${reverseDNS}&type=PTR`);
  const data = JSON.parse(response.data);
  return data?.Answer?.[0]?.data ?? 'Lookup Failed: NXDOMAIN';
}

async function fetchNetworkData() {
  return Promise.allSettled([
    httpMethod.get('http://208.95.112.1/json'),
    httpMethod.get(`http://${randomString32()}.edns.ip-api.com/json`)
  ]);
}

async function retryOperation(fn, retries, delay) {
  for (let attempts = 0; attempts < retries; attempts++) {
    try {
      return await fn();
    } catch (error) {
      if (attempts < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

const locationMap = new Map([
  ['JP', (info) => (info.regionName === 'Tokyo' && info.city === 'Tokyo') ? `${info.regionName}, ${info.country}` : `${info.city}, ${info.regionName}, ${info.country}`],
  ['CN', (info) => ['Beijing', 'Shanghai', 'Tianjin', 'Chongqing'].includes(info.regionName) ? `${info.regionName}, PRC` : `${info.city}, ${info.regionName}, PRC`],
  ['TW', (info) => /Taipei/.test(info.city) ? `Taipei, ROC (${info.country})` : `${info.city}, ROC (${info.country})`],
  ['DE', (info) => /Frankfurt/.test(info.city) ? `Frankfurt, ${info.country}` : `${info.city}, ${info.country}`],
  ['ZA', (info) => /Johannesburg/.test(info.city) ? `Jo'burg, ${info.country}` : `${info.city}, ${info.country}`],
  ['KR', (info) => `${info.city.split('-')[0]}, ${info.country}`],
  ['US', (info) => `${info.city}, ${info.region}, USA`],
  ['GU', (info) => `${info.city}, ${info.country} (US)`],
  ['CA', (info) => `${info.city}, ${info.region}, ${info.country}`],
  ['GB', (info) => `${info.city}, ${info.regionName}, UK`],
  ['AE', (info) => `${info.city}, ${info.region}, UAE`],
  ['HK', (info) => `${info.country} SAR, PRC`],
  ['MO', (info) => `${info.country} SAR, PRC`],
  ['SG', (info) => `${info.country} (${info.countryCode})`],
  ['VA', (info) => `${info.country} (${info.countryCode})`],
  ['MC', (info) => `${info.country} (${info.countryCode})`],
  ['GI', (info) => `${info.country} (${info.countryCode})`],
  ['default', (info) => `${info.city}, ${info.country}`]
]);

const dnsGeoMap = new Map([
  ["NTT", "NTT Corp."],
  ["KDDI", "KDDI Corp."],
  ["SoftBank", "SoftBank Corp."],
  ["Rakuten", "Rakuten Inc."],
  ["BIGLOBE", "BIGLOBE Inc."],
  ["Internet Initiative", "IIJ Inc."],
  ["ARTERIA", "ARTERIA Corp."],
  ["So-net", "So-net Corp."],
  ["Sony Network", "So-net Corp."],
  ["Cloudflare", "Cloudflare"],
  ["Google", "Google"],
  ["Amazon", "Amazon"],
  ["Microsoft", "Microsoft"],
  ["Oracle", "Oracle"],
  ["Alibaba", "Alibaba"],
  ["Tencent", "Tencent"],
  ["China Mobile", "China Mobile"],
  ["CHINAMOBILE", "China Mobile"],
  ["CMNET", "China Mobile"],
  ["China Unicom", "China Unicom"],
  ["CHINAUNICOM", "China Unicom"],
  ["CHINA169", "China Unicom"],
  ["China Telecom", "China Telecom"],
  ["CHINATELECOM", "China Telecom"],
  ["CHINANET", "China Telecom"],
  ["China Broadnet", "China Broadnet"],
  ["China Cable", "China Broadnet"],
  ["CBNET", "China Broadnet"],
  ["China Education", "CERNET"],
  ["CERNET", "CERNET"]
]);

async function getNetworkInfo(retryTimes = 5, retryInterval = 1000) {
  const networkInfoType = getNetworkInfoType();
  const protocolType = getProtocolType();
  const timestamp = getTimestamp();
  try {
    while (retryTimes-- > 0) {
      const [ipApiResponse, dnsApiResponse] = await Promise.all([
        retryOperation(() => httpMethod.get('http://208.95.112.1/json'), retryTimes, retryInterval),
        retryOperation(() => httpMethod.get(`http://${randomString32()}.edns.ip-api.com/json`), retryTimes, retryInterval)
      ]);
      if (ipApiResponse.status > 300 || dnsApiResponse.status > 300) {
        throw new Error("API Error");
      }
      const ipInfo = JSON.parse(ipApiResponse.data);
      const hostname = await resolveHostname(ipInfo.query);
      const location = (locationMap.get(ipInfo.countryCode) || locationMap.get('default'))(ipInfo);
      const dnsGeo = JSON.parse(dnsApiResponse.data).dns.geo;
      const [country, keyword] = dnsGeo.split(" - ");
      const keywordMatch = [...dnsGeoMap.keys()].find(key => keyword.toLowerCase().includes(key.toLowerCase()));
      const mappedDnsGeo = `${country} - ${dnsGeoMap.get(keywordMatch) || keyword}`;
      $done({
        title: `${networkInfoType.info} | ${protocolType} | ${timestamp}`,
        content: `IP Address: ${ipInfo.query}\nPTR: ${hostname}\nISP: ${ipInfo.as}\nLocation: ${location}\nDNS Info: ${mappedDnsGeo}`,
        icon: networkInfoType.type === 'WiFi' ? 'wifi' : 'simcard',
        'icon-color': '#73C2FB',
      });
      return;
    }
  } catch (error) {
    $done({
      title: 'Error',
      icon: 'wifi.exclamationmark',
      'icon-color': '#CB1B45',
    });
  }
}

(() => {
  getNetworkInfo();
})();