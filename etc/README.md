# ServerInfo Panel
`Install`
```bash
bash <(curl -sSLf "https://raw.githubusercontent.com/midori01/surge/main/etc/serverinfo.sh")
```
`Uninstall`
```bash
systemctl disable serverinfo --now && rm -f /etc/systemd/system/serverinfo.service /opt/serverinfo.py
```
