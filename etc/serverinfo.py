#!/usr/bin/env python3

import http.server
import socketserver
import json
import psutil
import socket
import subprocess
import time

class RequestHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        cpu_usage = psutil.cpu_percent()
        mem_usage = psutil.virtual_memory().percent
        net_io = psutil.net_io_counters()
        bytes_sent = net_io.bytes_sent
        bytes_recv = net_io.bytes_recv
        bytes_total = bytes_sent + bytes_recv
        uptime = int(time.time() - psutil.boot_time())
        hostname = socket.gethostname()
        ping_result = self.ping_host("210.2.4.8")
        
        response_dict = {
            "hostname": hostname,
            "uptime": uptime,
            "cpu_usage": cpu_usage,
            "mem_usage": mem_usage,
            "bytes_sent": str(bytes_sent),
            "bytes_recv": str(bytes_recv),
            "bytes_total": str(bytes_total),
            "ping_result": ping_result
        }
        
        response_json = json.dumps(response_dict).encode('utf-8')
        self.wfile.write(response_json)

    def ping_host(self, host):
        try:
            result = subprocess.run(["ping", "-c", "1", "-W", "1", host], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode == 0:
                return "Successful (GFW Pass)"
            else:
                return "Failed (GFW Blocked)"
        except Exception as e:
            return "Error"

def run_server():
    with socketserver.ThreadingTCPServer(("0.0.0.0", 7122), RequestHandler) as httpd:
        try:
            print(f"Serving at port 7122")
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("KeyboardInterrupt is captured, program exited")
        except Exception as e:
            print(f"An error occurred: {e}")

if __name__ == "__main__":
    run_server()