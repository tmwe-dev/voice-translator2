#!/usr/bin/env bash
# ═══ Redis in SPAZIO UTENTE: niente sudo, solo fonti ufficiali ═══
set -euo pipefail
BASE=~/bartalk-redis
mkdir -p $BASE/{node,redis,dati}
cd $BASE

# 1. Node ufficiale (nodejs.org)
if [ ! -x $BASE/node/bin/node ]; then
  curl -fsSL https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz -o node.tar.xz
  tar -xf node.tar.xz --strip-components=1 -C $BASE/node && rm node.tar.xz
fi

# 2. redis-server dai pacchetti UFFICIALI Ubuntu (spacchettato, non installato)
if [ ! -x $BASE/redis/usr/bin/redis-server ]; then
  cd $BASE/redis
  BASEURL=http://archive.ubuntu.com/ubuntu/pool/universe/r/redis
  # nome esatto scoperto dall'indice
  DEB=$(curl -fsSL $BASEURL/ | grep -oE 'redis-server_[^"]+amd64\.deb' | sort -V | tail -1)
  TOOLS=$(curl -fsSL $BASEURL/ | grep -oE 'redis-tools_[^"]+amd64\.deb' | sort -V | tail -1)
  curl -fsSL $BASEURL/$DEB -o server.deb
  curl -fsSL $BASEURL/$TOOLS -o tools.deb
  dpkg -x server.deb . && dpkg -x tools.deb . && rm -f server.deb tools.deb
  # libjemalloc se manca nel sistema
  if ! ldconfig -p 2>/dev/null | grep -q libjemalloc; then
    LIBURL=http://archive.ubuntu.com/ubuntu/pool/universe/j/jemalloc
    LIB=$(curl -fsSL $LIBURL/ | grep -oE 'libjemalloc2_[^"]+amd64\.deb' | sort -V | tail -1)
    curl -fsSL $LIBURL/$LIB -o lib.deb && dpkg -x lib.deb . && rm lib.deb
  fi
  cd $BASE
fi

# 3. il gettone
if [ ! -f $BASE/token.txt ]; then
  head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40 > $BASE/token.txt
fi
cp ~/redis-utente/proxy.mjs $BASE/proxy.mjs
cp $BASE/token.txt $BASE/token.txt

# 4. avvio (e riavvio pulito se gia in piedi)
pkill -f 'redis-server 127.0.0.1:6390' 2>/dev/null || true
pkill -f 'bartalk-redis/proxy.mjs' 2>/dev/null || true
sleep 1
LD_LIBRARY_PATH=$BASE/redis/usr/lib/x86_64-linux-gnu nohup $BASE/redis/usr/bin/redis-server \
  --port 6390 --bind 127.0.0.1 --dir $BASE/dati --appendonly yes \
  --maxmemory 2gb --maxmemory-policy allkeys-lru \
  > $BASE/redis.log 2>&1 &
sleep 1
nohup $BASE/node/bin/node $BASE/proxy.mjs > $BASE/proxy.log 2>&1 &
sleep 1

# 5. ripartenza automatica a ogni riavvio della macchina (crontab utente)
( crontab -l 2>/dev/null | grep -v bartalk-redis; \
  echo "@reboot LD_LIBRARY_PATH=$HOME/bartalk-redis/redis/usr/lib/x86_64-linux-gnu $HOME/bartalk-redis/redis/usr/bin/redis-server --port 6390 --bind 127.0.0.1 --dir $HOME/bartalk-redis/dati --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru >> $HOME/bartalk-redis/redis.log 2>&1"; \
  echo "@reboot sleep 5 && $HOME/bartalk-redis/node/bin/node $HOME/bartalk-redis/proxy.mjs >> $HOME/bartalk-redis/proxy.log 2>&1" ) | crontab -

# 6. prova completa: PING via proxy
TOKEN=$(cat $BASE/token.txt)
PING=$(curl -s -m 4 -H "Authorization: Bearer $TOKEN" -d '["PING"]' http://localhost:8079 || true)
echo "PROVA-PING: $PING"
echo "TOKEN-FILE: $BASE/token.txt"
