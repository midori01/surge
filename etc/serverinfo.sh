#!/bin/bash

apt update && apt install -y python3 python3-pip python3-psutil
mkdir -p /opt
wget -O /opt/serverinfo.py https://raw.githubusercontent.com/midori01/surge/main/etc/serverinfo.py
cat > /etc/systemd/system/serverinfo.service <<EOF
[Unit]
Description=ServerInfo Monitor

[Service]
Type=simple
WorkingDirectory=/opt/
User=root
ExecStart=/usr/bin/python3 /opt/serverinfo.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable serverinfo.service --now
