class httpMethod {
  static async request(method, option = {}) {
    return new Promise((resolve, reject) => {
      $httpClient[method](option, (error, response, data) => {
        if (error) reject(error);
        else resolve({ ...response, data });
      });
    });
  }
  static get(option = {}) {
    return this.request('get', option);
  }
}

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

const networkInfoType = (() => {
  const wifiSSID = $network.wifi?.ssid;
  if (wifiSSID) return { type: 'WiFi', info: wifiSSID };
  const radio = $network['cellular-data']?.radio;
  return { type: 'Cellular', info: `${radioGeneration[radio] || ''} ${radio}`.trim() };
})();

const protocolType = $network.v6?.primaryAddress ? 'Dual Stack' : 'IPv4 Only';
const timestamp = new Date().toTimeString().slice(0, 5);

function randomString32() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(array).map(byte => chars[byte % chars.length]).join('');
}

async function resolveHostname(ip) {
  try {
    const reverseDNS = ip.split('.').reverse().join('.') + '.in-addr.arpa';
    const response = await httpMethod.get({ url: `http://223.5.5.5/resolve?name=${reverseDNS}&type=PTR` });
    const data = JSON.parse(response.data);
    return data?.Answer?.[0]?.data ?? 'Lookup Failed: NXDOMAIN';
  } catch (error) {
    return 'Lookup Failed: Network Error';
  }
}

async function retryOperation(fn, retries, delay) {
  for (const _ of Array(retries)) {
    try {
      return await fn();
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Operation failed after retries');
}

async function getNetworkInfo(retryTimes = 3, retryInterval = 1000) {
  try {
    const [ipApiResponse, dnsApiResponse] = await Promise.all([
      retryOperation(() => httpMethod.get({ url: 'http://208.95.112.1/json' }), retryTimes, retryInterval),
      retryOperation(() => httpMethod.get({ url: `http://${randomString32()}.edns.ip-api.com/json` }), retryTimes, retryInterval)
    ]);
    const ipInfo = JSON.parse(ipApiResponse.data);
    const [hostname, location] = await Promise.all([
      resolveHostname(ipInfo.query),
      (locationMap.get(ipInfo.countryCode) || locationMap.get('default'))(ipInfo)
    ]);
    const dnsGeo = JSON.parse(dnsApiResponse.data).dns.geo;
    const [country, keyword] = dnsGeo.split(" - ");
    const keywordMatch = [...dnsGeoMap.keys()].find(key => keyword.toLowerCase().includes(key.toLowerCase()));
    const mappedDnsGeo = `${country} - ${dnsGeoMap.get(keywordMatch) || keyword}`;
    $done({
      title: `${networkInfoType.info} | ${protocolType} | ${timestamp}`,
      content: `IP Address: ${ipInfo.query}\nPTR: ${hostname}\nISP: ${ipInfo.as}\nLocation: ${location}\nDNS Exit: ${mappedDnsGeo}`,
      icon: networkInfoType.type === 'WiFi' ? 'wifi' : 'simcard',
      'icon-color': '#73C2FB',
    });
  } catch (error) {
    $done({
      title: 'Error',
      content: `${error.message}`,
      icon: 'wifi.exclamationmark',
      'icon-color': '#CB1B45',
    });
  }
}

(() => {
  getNetworkInfo();
})();

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
  ["NTT", "NTT"],
  ["KDDI", "KDDI"],
  ["SoftBank", "SoftBank"],
  ["Internet Initiative", "IIJ"],
  ["Rakuten", "Rakuten"],
  ["BIGLOBE", "BIGLOBE"],
  ["So-net", "So-net"],
  ["Sony Network", "So-net"],
  ["ARTERIA", "ARTERIA"],
  ["OPTAGE", "OPTAGE"],
  ["IDC Frontier", "IDC Frontier"],
  ["SAKURA", "SAKURA"],
  ["Cloudflare", "Cloudflare"],
  ["Google", "Google"],
  ["Amazon", "Amazon"],
  ["Microsoft", "Microsoft"],
  ["Linode", "Linode"],
  ["Akamai", "Akamai"],
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