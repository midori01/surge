(async () => {
    const panel = {
        title: "DNS",
        icon: "cube",
        "icon-color": "#FF7E00"
    };
    let showServer = false;
    let dnsCache;

    if (typeof $argument !== "undefined") {
        const args = Object.fromEntries($argument.split("&").map(item => item.split("=")));
        panel.title = args.title || panel.title;
        panel.icon = args.icon || panel.icon;
        panel["icon-color"] = args.color || panel["icon-color"];
        showServer = args.server === "true";
    }

    if (showServer) {
        const { dnsCache: cache } = await httpAPI("/v1/dns", "GET");
        dnsCache = [...new Set(cache.map(d => d.server))].join(", ");
    }

    if ($trigger === "button") await httpAPI("/v1/dns/flush");

    const { delay } = await httpAPI("/v1/test/dns_delay");
    panel.content = `[Latency] ${(delay * 1000).toFixed(0)} ms${dnsCache ? `\n[Servers] ${dnsCache}` : ""}`;

    $done(panel);
})();

function httpAPI(path = "", method = "POST", body = null) {
    return new Promise((resolve) => {
        $httpAPI(method, path, body, resolve);
    });
}
