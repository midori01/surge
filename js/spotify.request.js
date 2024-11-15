let url = $request.url;
if (url.match(/^https:\/\/spclient\.wg\.spotify\.com\/user-customization-service\/v1\/customize$/)) {
    let headers = $request.headers;
    if (headers['if-none-match']) {
        delete headers['if-none-match'];
    }
    $done({
        url,
        headers
    });
} else {
    if (url.includes('platform=iphone')) {
        url = url.replace(/platform=iphone/, 'platform=ipad');
    }
    $done({ url });
}