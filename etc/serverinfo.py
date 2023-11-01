#!/usr/bin/env python3

import http.server
import socketserver
import json
import time
import psutil

port = 7122

class RequestHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        time.sleep(1)
        cpu_usage = psutil.cpu_percent()
        mem_usage = psutil.virtual_memory().percent
        bytes_sent = psutil.net_io_counters().bytes_sent
        bytes_recv = psutil.net_io_counters().bytes_recv
        bytes_total = bytes_sent + bytes_recv
        utc_timestamp = int(time.time())
        uptime = int(time.time() - psutil.boot_time())
        last_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        response_dict = {
            "utc_timestamp": utc_timestamp,
            "uptime": uptime,
            "cpu_usage": cpu_usage,
            "mem_usage": mem_usage,
            "bytes_sent": str(bytes_sent),
            "bytes_recv": str(bytes_recv),
            "bytes_total": str(bytes_total),
            "last_time": last_time
        }
        response_json = json.dumps(response_dict).encode('utf-8')
        self.wfile.write(response_json)
with socketserver.ThreadingTCPServer(("", port), RequestHandler, bind_and_activate=False) as httpd:
    try:
        print(f"Serving at port {port}")
        httpd.allow_reuse_address = True
        httpd.server_bind()
        httpd.server_activate()
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("KeyboardInterrupt is captured, program exited")
