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
  'NRNSA': '5G NRNSA',
  'NR': '5G NR'
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

function formatTimezone(timezone) {
  const [region, city] = timezone.split('/');
  const abbreviation = timezoneAbbreviations.get(city) || city.replace('_', '');
  return `${region}/${abbreviation}`;
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

async function withTimeout(promise, timeout) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeout))
  ]);
}

async function resolveHostname(ip, timeout = 2000) {
  const reverseDNS = ip.split('.').reverse().join('.') + '.in-addr.arpa';
  try {
    const response = await withTimeout(
      httpMethod.get({ url: `https://doh.pub/dns-query?name=${reverseDNS}&type=PTR` }),
      timeout
    );
    const data = JSON.parse(response.data);
    return data?.Answer?.[0]?.data ?? 'Lookup Failed - NXDOMAIN';
  } catch {
    return 'Lookup Failed - API Timeout';
  }
}

async function getNetworkInfo() {
  try {
    const timeout = 3000;
    const [ipApiResponse, dnsApiResponse, dnsData] = await Promise.all([
      withTimeout(httpMethod.get({ url: 'http://ip-api.com/json/?fields=66846719' }), timeout),
      withTimeout(httpMethod.get({ url: `http://${randomString32()}.edns.ip-api.com/json` }), timeout),
      withTimeout(httpAPI("/v1/dns", "GET"), timeout)
    ]);
    const ipInfo = JSON.parse(ipApiResponse.data);
    const { dns, edns } = JSON.parse(dnsApiResponse.data);
    const [hostname, location] = await Promise.all([
      resolveHostname(ipInfo.query),
      (locationMap.get(ipInfo.countryCode) || locationMap.get('default'))(ipInfo)
    ]);
    const timezoneInfo = `${formatTimezone(ipInfo.timezone)} UTC${ipInfo.offset >= 0 ? '+' : ''}${ipInfo.offset / 3600}`;
    const coordinates = formatCoordinates(ipInfo.lat, ipInfo.lon);
    const dnsServers = [...new Set(dnsData.dnsCache.map(d => d.server.replace(/(https?|quic|h3):\/\/([^\/]+)\/dns-query/, "$1://$2")))];
    const isEncrypted = dnsServers.some(d => /^(quic|https?|h3)/i.test(d));
    const dnsServer = dnsServers.filter(d => isEncrypted ? /^(quic|https?|h3)/i.test(d) : true).join(", ") || "No DNS Servers Found";
    const dnsGeo = dns.geo;
    const ednsInfo = edns?.ip || 'Unavailable';
    const ipType = ipInfo.hosting ? '(Datacenter)' : '(Residential)';
    const [country, keyword] = dnsGeo.split(" - ");
    const keywordMatch = [...dnsGeoMap.keys()].find(key => keyword.toLowerCase().includes(key.toLowerCase()));
    const mappedDnsGeo = dnsGeo.includes("Internet Initiative Japan") ? "Internet Initiative Japan" : `${country} - ${dnsGeoMap.get(keywordMatch) || keyword}`;
    $done({
      title: `${networkInfoType.info} | ${protocolType} | ${timestamp}`,
      content: `IP: ${ipInfo.query} ${ipType}\nPTR: ${hostname}\nISP: ${ipInfo.as}\nLocation: ${location}\nCoords: ${coordinates}\nTimezone: ${timezoneInfo}\nResolver: ${dnsServer}\nLeakDNS: ${mappedDnsGeo}\nEDNS Client Subnet: ${ednsInfo}`,
      icon: networkInfoType.type === 'WiFi' ? 'wifi' : networkInfoType.info === 'Ethernet' ? 'cable.connector.horizontal' : 'cellularbars',
      'icon-color': '#73C2FB',
    });
  } catch (error) {
    $done({
      title: 'Error',
      content: error.message,
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
  ['US', (info) => `${info.city}, ${info.region}, US`],
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
  ["So-net", "Sony Network"],
  ["Sony Network", "Sony Network"],
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

const timezoneAbbreviations = new Map([
  ["Los_Angeles", "Angeles"],
  ["Mexico_City", "Mexico"],
  ["Johannesburg", "Jo'burg"]
]);