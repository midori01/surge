class httpMethod {
  static request(method, option = {}) {
    return new Promise((r, j) => $httpClient[method](option, (e, res, d) => e ? j(e) : r({ ...res, data: d })));
  }
  static get(option = {}) {
    return this.request('get', option);
  }
}

const radioGeneration = new Map([
  ['GPRS', 'GPRS'],
  ['Edge', 'EDGE'],
  ['WCDMA', 'WCDMA'],
  ['HSDPA', 'HSDPA'],
  ['HSUPA', 'HSUPA'],
  ['CDMA1x', 'CDMA 1x'],
  ['CDMAEVDORev0', 'CDMA EV-DO'],
  ['CDMAEVDORevA', 'CDMA EV-DO'],
  ['CDMAEVDORevB', 'CDMA EV-DO'],
  ['eHRPD', 'eHRPD'],
  ['HRPD', 'HRPD'],
  ['LTE', '4G LTE'],
  ['NRNSA', '5G Sub‑6'],
  ['NR', '5G Sub-6']
]);

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

const timezoneAbbreviations = new Map([
  ["Los_Angeles", "Angeles"],
  ["Mexico_City", "Mexico"],
  ["Johannesburg", "Jo'burg"],
  ["Amsterdam", "A'dam"]
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

const networkInfoType = (() => {
  const wifiSSID = $network.wifi?.ssid;
  if (wifiSSID) return { type: 'WiFi', info: wifiSSID };
  const radio = $network['cellular-data']?.radio;
  return { type: 'Cellular', info: radioGeneration.get(radio) || 'Ethernet' };
})();

const protocolType = $network.v6?.primaryAddress ? 'IPv4/IPv6' : 'IPv4 Only';
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
  try {
    const { data } = await withTimeout(httpMethod.get({
      url: `https://doh.pub/dns-query?name=${ip.split('.').reverse().join('.')}.in-addr.arpa&type=PTR`
    }), timeout);
    return JSON.parse(data)?.Answer?.[0]?.data || 'Lookup Failed - NXDOMAIN';
  } catch {
    return 'Lookup Failed - TIMEOUT!';
  }
}

async function getNetworkInfo() {
  const timeout = 3000;
  const [ipApiResponse, dnsApiResponse, dnsDataResponse, dnsDelayResponse] = await Promise.all([
    withTimeout(httpMethod.get({ url: 'http://ip-api.com/json/?fields=66846719' }), timeout).catch(err => ({ error: err.message })),
    withTimeout(httpMethod.get({ url: `http://${randomString32()}.edns.ip-api.com/json` }), timeout).catch(err => ({ error: err.message })),
    withTimeout(httpAPI("/v1/dns", "GET"), timeout).catch(err => ({ error: err.message })),
    withTimeout(httpAPI("/v1/test/dns_delay", "POST"), timeout).catch(err => ({ error: err.message }))
  ]);
  const errors = [
    ipApiResponse.error && `ipApi: ${ipApiResponse.error}`,
    dnsApiResponse.error && `dnsApi: ${dnsApiResponse.error}`,
    dnsDataResponse.error && `dnsData: ${dnsDataResponse.error}`,
    dnsDelayResponse.error && `dnsDelay: ${dnsDelayResponse.error}`
  ].filter(Boolean).join('\n');
  if (errors) {
    $done({
      title: 'Error',
      content: errors,
      icon: 'wifi.exclamationmark',
      'icon-color': '#CB1B45',
    });
    return;
  }
  const ipInfo = JSON.parse(ipApiResponse.data);
  const { dns, edns } = JSON.parse(dnsApiResponse.data);
  const [hostname, location] = await Promise.all([
    resolveHostname(ipInfo.query),
    (locationMap.get(ipInfo.countryCode) || locationMap.get('default'))(ipInfo)
  ]);
  const timezoneInfo = `${formatTimezone(ipInfo.timezone)} UTC${ipInfo.offset >= 0 ? '+' : ''}${ipInfo.offset / 3600}`;
  const coordinates = formatCoordinates(ipInfo.lat, ipInfo.lon);
  const dnsServers = [...new Set(dnsDataResponse.dnsCache.map(d => d.server.replace(/(https?|quic|h3):\/\/([^\/]+)\/dns-query/, "$1://$2")))];
  const isEncrypted = dnsServers.some(d => /^(quic|tls|h3|https)/i.test(d));
  const dnsServer = dnsServers.find(d => isEncrypted ? /^(quic|https?|h3)/i.test(d) : true) || "No DNS servers found";
  const dnsDelay = isEncrypted || dnsServer === "No DNS servers found" || !dnsDelayResponse.delay || isNaN(dnsDelayResponse.delay) ? '' : ` - ${(dnsDelayResponse.delay * 1000).toFixed(0)} ms`;
  const ednsInfo = edns?.ip || 'Unavailable';
  const ipType = ipInfo.hosting ? '(Datacenter)' : '(Residential)';
  const [country, keyword] = dns.geo.split(" - ");
  const keywordMatch = [...dnsGeoMap.keys()].find(key => keyword.toLowerCase().includes(key.toLowerCase()));
  const mappedDnsGeo = dns.geo.includes("Internet Initiative Japan") ? "Internet Initiative Japan" : `${country} - ${dnsGeoMap.get(keywordMatch) || keyword}`;
  $done({
    title: `${networkInfoType.info} | ${protocolType} | ${timestamp}`,
    content: `IP: ${ipInfo.query} ${ipType}\nPTR: ${hostname}\nISP: ${ipInfo.as}\nLocation: ${location}\nCoords: ${coordinates}\nTimezone: ${timezoneInfo}\nResolver: ${dnsServer}${dnsDelay}\nDNS Exit: ${mappedDnsGeo}\nEDNS Client Subnet: ${ednsInfo}`,
    icon: networkInfoType.type === 'WiFi' ? 'wifi' : networkInfoType.info === 'Ethernet' ? 'cable.connector.horizontal' : 'cellularbars',
    'icon-color': '#73C2FB',
  });
}

(() => {
  getNetworkInfo();
})();