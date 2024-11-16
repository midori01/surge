$httpClient.get('http://119.29.29.29/d?dn=' + $domain, function(error, response, data){
  if (error) {
    $done({});
  } else {
$done({addresses: data.split(';'), ttl: 600});
  }
});
