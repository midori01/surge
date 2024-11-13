#!/bin/bash

set -e
apt update && apt install -y python3 python3-pip python3-psutil
INSTALL_DIR="/opt"
SERVICE_FILE="/etc/systemd/system/serverinfo.service"
mkdir -p "$INSTALL_DIR"
wget -q -O "$INSTALL_DIR/serverinfo.py" https://raw.githubusercontent.com/midori01/surge/main/etc/serverinfo.py

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=ServerInfo Monitor
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
User=root
ExecStart=/usr/bin/python3 $INSTALL_DIR/serverinfo.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now serverinfo.service
systemctl restart serverinfo.service

sleep 2
if ss -tuln | grep -q ':7122'; then
    echo "安装成功，服务监听端口 7122。"
else
    echo "安装失败，请检查服务状态" >&2
    exit 1
fi
