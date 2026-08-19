#!/usr/bin/env bash
# ═══ BarTalk — installazione coturn su Ubuntu (Oracle Always Free) ═══
# Uso: sudo bash setup.sh IP_PUBBLICO_DELLA_VM
set -euo pipefail
IP="${1:?Uso: sudo bash setup.sh IP_PUBBLICO_DELLA_VM}"

apt-get update -y && apt-get install -y coturn

# il segreto: generato qui, stampato alla fine — va copiato su Vercel
SEGRETO=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40)

# 644: coturn gira come utente "turnserver" e DEVE poter leggere il file.
# (Con 640 root:root partiva coi valori di fabbrica, in silenzio: realm
# vuoto, niente segreto — trovato dal vivo il 19/08.)
install -m 644 "$(dirname "$0")/turnserver.conf" /etc/turnserver.conf
sed -i "s/CAMBIAMI_SEGRETO_LUNGO_E_CASUALE/${SEGRETO}/" /etc/turnserver.conf
sed -i "s/# external-ip=IP_PUBBLICO_DELLA_VM/external-ip=${IP}/" /etc/turnserver.conf

# coturn parte da solo a ogni avvio
sed -i 's/^#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn || true
systemctl enable coturn
systemctl restart coturn

# firewall della VM (Oracle: aprire le stesse porte anche nella Security List!)
if command -v ufw >/dev/null; then
  ufw allow 3478/udp; ufw allow 3478/tcp; ufw allow 5349/tcp; ufw allow 49160:49260/udp
fi
# Oracle Ubuntu usa anche iptables via netfilter-persistent
iptables -I INPUT -p udp --dport 3478 -j ACCEPT
iptables -I INPUT -p tcp --dport 3478 -j ACCEPT
iptables -I INPUT -p tcp --dport 5349 -j ACCEPT
iptables -I INPUT -p udp --dport 49160:49260 -j ACCEPT
netfilter-persistent save 2>/dev/null || true

echo
echo "════════════════════════════════════════════════"
echo " coturn ATTIVO su ${IP}"
echo
echo " Su Vercel (Settings → Environment Variables, Production):"
echo "   TURN_SECRET = ${SEGRETO}"
echo "   TURN_URLS   = turn:${IP}:3478"
echo " (col dominio e il TLS: turn:turn.bartalk.app:3478,turns:turn.bartalk.app:5349)"
echo "════════════════════════════════════════════════"
