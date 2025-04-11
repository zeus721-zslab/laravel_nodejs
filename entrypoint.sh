#!/bin/sh

#---------------------------------- http, staging에서는 사용 안함


set -e # 오류 시 즉시 중단

CERT_DIR="/etc/letsencrypt/live/zslab.duckdns.org"
PRIV_KEY_PATH="${CERT_DIR}/privkey.pem"
FULL_CHAIN_PATH="${CERT_DIR}/fullchain.pem"
TMP_CERT_DIR="/tmp/certs"
TMP_PRIV_KEY_PATH="${TMP_CERT_DIR}/privkey.pem"
TMP_FULL_CHAIN_PATH="${TMP_CERT_DIR}/fullchain.pem"

# --- 디버깅 로그 추가 ---
echo "[Entrypoint] 스크립트 시작. 현재 사용자: $(whoami)"
echo "[Entrypoint] /etc/letsencrypt/live/zslab.duckdns.org/ 내용 확인:"
ls -al /etc/letsencrypt/live/zslab.duckdns.org/
echo "[Entrypoint] 인증서 파일 존재 여부 확인 시도..."
# --- 디버깅 로그 추가 끝 ---

mkdir -p ${TMP_CERT_DIR}

# 인증서 파일 존재 확인 및 복사
if [ -f "$PRIV_KEY_PATH" ] && [ -f "$FULL_CHAIN_PATH" ]; then
  echo "[Entrypoint] 인증서 파일을 ${TMP_CERT_DIR} 로 복사합니다..."
  cp "$PRIV_KEY_PATH" "$TMP_PRIV_KEY_PATH"
  cp "$FULL_CHAIN_PATH" "$TMP_FULL_CHAIN_PATH"

  echo "[Entrypoint] 복사된 인증서 파일의 소유권을 node:node 로 변경합니다..."
  chown node:node ${TMP_CERT_DIR}/*
  chmod 600 ${TMP_CERT_DIR}/*

  echo "[Entrypoint] 인증서 준비 완료."
else
  echo "[Entrypoint] 경고: 원본 인증서 파일($PRIV_KEY_PATH 또는 $FULL_CHAIN_PATH)을 찾을 수 없습니다!"
fi

# --- gosu 테스트 로그 추가 ---
echo "[Entrypoint] gosu node whoami 테스트 실행 시도..."
gosu node whoami # 여기서 에러가 나는지 확인
echo "[Entrypoint] gosu node whoami 테스트 성공 (위 라인에 'node' 출력 확인)"
# --- gosu 테스트 로그 추가 끝 ---


echo "[Entrypoint] 원래 명령($*)을 node 사용자로 실행합니다..."
exec gosu node "$@" # 최종 실행
