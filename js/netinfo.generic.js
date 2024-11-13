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
  'GPRS': 'GPRS',
  'Edge': 'EDGE',
  'WCDMA': 'WCDMA',
  'HSDPA': 'HSDPA',
  'HSUPA': 'HSUPA',
  'CDMA1x': 'CDMA 1x',
  'CDMAEVDORev0': 'CDMA EV-DO',
  'CDMAEVDORevA': 'CDMA EV-DO',
  'CDMAEVDORevB': 'CDMA EV-DO',
  'eHRPD': 'eHRPD',
  'HRPD': 'HRPD',
  'LTE': '4G LTE',
  'NRNSA': '5G NR NSA',
  'NR': '5G NR SA'
};

const networkInfoType = (() => {
  const wifiSSID = $network.wifi?.ssid;
  if (wifiSSID) return { type: 'WiFi', info: wifiSSID };
  const radio = $network['cellular-data']?.radio;
  return { type: 'Cellular', info: `${radioGeneration[radio] || 'Ethernet'}`.trim() };
})();

const protocolType = $network.v6?.primaryAddress ? 'Dual Stack' : 'IPv4 Only';
const timestamp = new Date().toTimeString().slice(0, 5);

function httpAPI(path = "", method = "POST", body = null) {
  return new Promise(resolve => $httpAPI(method, path, body, resolve));
}

function randomString32() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => "abcdefghijklmnopqrstuvwxyz0123456789"[byte % 36]).join('');
}

function formatCoordinates(lat, lon) {
  const toDMS = (value, pos, neg) => {
    const d = Math.floor(Math.abs(value));
    const m = Math.floor((Math.abs(value) - d) * 60);
    const s = Math.round(((Math.abs(value) - d) * 60 - m) * 60);
    return `${d}°${m}′${s}″${value >= 0 ? pos : neg}`;
  };
  return `${toDMS(lat, 'N', 'S')} ${toDMS(lon, 'E', 'W')}`;
}

async function resolveHostname(ip) {
  try {
    const reverseDNS = ip.split('.').reverse().join('.') + '.in-addr.arpa';
    const response = await httpMethod.get({ url: `https://dns.google/resolve?name=${reverseDNS}&type=PTR` });
    const data = JSON.parse(response.data);
    return data?.Answer?.[0]?.data ?? 'Lookup Failed - NXDOMAIN';
  } catch (error) {
    return 'Lookup Failed - Network Error';
  }
}

async function retryOperation(fn, retries, delay) {
  let attempts = retries;
  while (attempts--) {
    try {
      return await fn();
    } catch (error) {
      if (attempts > 0) await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Operation failed after retries');
}

async function getNetworkInfo(retryTimes = 3, retryInterval = 1000) {
  try {
    const [ipApiResponse, dnsApiResponse, dnsData] = await Promise.all([
      retryOperation(() => httpMethod.get({ url: 'http://ip-api.com/json/?fields=66846719' }), retryTimes, retryInterval),
      retryOperation(() => httpMethod.get({ url: `http://${randomString32()}.edns.ip-api.com/json` }), retryTimes, retryInterval),
      httpAPI("/v1/dns", "GET")
    ]);
    const ipInfo = JSON.parse(ipApiResponse.data);
    const { dns, edns } = JSON.parse(dnsApiResponse.data);
    const [hostname, location] = await Promise.all([
      resolveHostname(ipInfo.query),
      (locationMap.get(ipInfo.countryCode) || locationMap.get('default'))(ipInfo)
    ]);
    const coordinates = formatCoordinates(ipInfo.lat, ipInfo.lon);
    const dnsServers = new Set(dnsData.dnsCache.map(d => d.server.replace(/(https?|quic|h3):\/\/([^\/]+)\/dns-query/, "$1://$2")));
    const isEncrypted = Array.from(dnsServers).some(d => /^(quic|https?|h3)/i.test(d));
    const dnsServer = Array.from(dnsServers).filter(d => isEncrypted ? /^(quic|https?|h3)/i.test(d) : true).join(", ") || "No DNS Servers Found";
    const dnsGeo = dns.geo;
    const ednsInfo = edns?.ip || 'Unavailable';
    const ipType = ipInfo.hosting ? 'Datacenter IP' : 'Residential IP';
    const [country, keyword] = dnsGeo.split(" - ");
    const keywordMatch = [...dnsGeoMap.keys()].find(key => keyword.toLowerCase().includes(key.toLowerCase()));
    const mappedDnsGeo = dnsGeo.includes("Internet Initiative Japan") ? "Internet Initiative Japan" : `${country} - ${dnsGeoMap.get(keywordMatch) || keyword}`;
    $done({
      title: `${networkInfoType.info} | ${protocolType} | ${timestamp}`,
      content: `${ipType}: ${ipInfo.query}\nPTR: ${hostname}\nISP: ${ipInfo.as}\nLocation: ${location}\nCoords: ${coordinates}\nResolver: ${dnsServer}\nDNS Leak: ${mappedDnsGeo}\nEDNS Client Subnet: ${ednsInfo}`,
      icon: networkInfoType.type === 'WiFi' ? 'wifi' : networkInfoType.info === 'Ethernet' ? 'cable.connector.horizontal' : 'cellularbars',
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
  ["Internet Initiative Japan", "IIJ"],
  ["Rakuten", "Rakuten"],
  ["BIGLOBE", "BIGLOBE"],
  ["So-net", "So-net"],
  ["Sony Network", "So-net"],
  ["ARTERIA", "ARTERIA"],
  ["OPTAGE", "OPTAGE"],
  ["IDC Frontier", "IDC Frontier"],
  ["SAKURA", "SAKURA"],
  ["Chunghwa Telecom", "Chunghwa Telecom"],
  ["Data Communication Business", "Chunghwa Telecom"],
  ["HINET", "Chunghwa Telecom"],
  ["Cloudflare", "Cloudflare"],
  ["Google", "Google"],
  ["Amazon", "Amazon"],
  ["Microsoft", "Microsoft"],
  ["Linode", "Linode"],
  ["Akamai", "Akamai"],
  ["Oracle", "Oracle"],
  ["DataCamp", "DataCamp"],
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