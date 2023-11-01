#!/bin/bash

apt update && apt install -y python3 python3-pip python3-psutil
wget -O /root/serverinfo.py https://raw.githubusercontent.com/midori01/surge/main/etc/serverinfo.py
cat > /etc/systemd/system/serverinfo.service <<EOF
[Unit]
Description=Server Info Monitor

[Service]
Type=simple
WorkingDirectory=/root/
User=root
ExecStart=/usr/bin/python3 /root/serverinfo.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable serverinfo.service --now
