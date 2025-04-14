// server.js
require('dotenv').config();

// --- ★ 필요한 모듈들 불러오기 ★ ---
const http = require('http'); // HTTP 모듈
const https = require('https'); // HTTPS 모듈
const fs = require('fs'); // 파일 시스템 모듈 (HTTPS 인증서 읽기용)
const { Server } = require("socket.io");
const express = require('express');

// 분리된 모듈 가져오기
const redisClient = require('./redisClient');
const { initializeSocket } = require('./socketHandler');
const { startRedisListener } = require('./redisListener');

const app = express();

let server; // HTTP 또는 HTTPS 서버 인스턴스를 담을 변수
const serverMode = process.env.SOCKET_SERVER_MODE || 'http'; // .env: SOCKET_SERVER_MODE=https 또는 http (기본값 http)
const PORT = process.env.PORT || 3001; // .env: PORT=3001 (또는 다른 포트)

console.log(`[ENV] Server Mode: ${serverMode}, Port: ${PORT}`); // 환경 변수 로깅

if (serverMode === 'https') {
    // --- ★ HTTPS 서버 생성 ★ ---
    console.log('[MODE] Attempting to start HTTPS server...');
    try {
        // Entrypoint 스크립트가 복사한 인증서 경로 (로그 기반)
        const privateKeyPath = '/tmp/certs/privkey.pem';
        const certificatePath = '/tmp/certs/fullchain.pem'; // fullchain 사용 권장

        // 인증서 파일 존재 여부 확인
        if (fs.existsSync(privateKeyPath) && fs.existsSync(certificatePath)) {
            const httpsOptions = {
                key: fs.readFileSync(privateKeyPath),
                cert: fs.readFileSync(certificatePath)
                // 필요시 ca: fs.readFileSync('/path/to/ca_bundle.pem') 추가
            };
            server = https.createServer(httpsOptions, app); // HTTPS 서버 생성
            console.log(`[MODE] Node.js HTTPS SocketIO 서버가 포트 ${PORT}에서 시작 준비 중...`);
        } else {
            // 인증서 파일 없을 시 오류 처리 및 HTTP로 대체 실행
            console.error(`[ERROR] HTTPS mode required, but certificate files not found! Paths checked: ${privateKeyPath}, ${certificatePath}`);
            console.error('[FALLBACK] Starting HTTP server instead.');
            server = http.createServer(app); // HTTP 서버로 대체
            console.log(`[MODE] Node.js HTTP SocketIO 서버가 포트 ${PORT}에서 시작 준비 중 (HTTPS fallback)...`);
        }
    } catch (err) {
        // HTTPS 서버 생성 중 다른 오류 발생 시 HTTP로 대체 실행
        console.error('[ERROR] Failed to create HTTPS server, falling back to HTTP:', err);
        server = http.createServer(app); // HTTP 서버로 대체
        console.log(`[MODE] Node.js HTTP SocketIO 서버가 포트 ${PORT}에서 시작 준비 중 (HTTPS error fallback)...`);
    }

} else {
    // --- ★ HTTP 서버 생성 (기본) ★ ---
    console.log('[MODE] Starting HTTP server...');
    server = http.createServer(app); // HTTP 서버 생성
    console.log(`[MODE] Node.js HTTP SocketIO 서버가 포트 ${PORT}에서 시작 준비 중...`);
}

// --- CORS 설정 (Socket.IO 옵션 사용) ---
const corsOriginString = process.env.CORS_ORIGIN || '';
const allowedOriginsArray = corsOriginString.split(',').map(origin => origin.trim()).filter(origin => origin);
console.log("[CORS] Allowed CORS Origins Array (for Socket.IO options):", allowedOriginsArray);

const io = new Server(server, { // 'server' 변수는 http 또는 https 서버 인스턴스
    cors: {
        origin: function (origin, callback) {
            // origin이 허용 목록에 있거나, origin 값이 없는 경우(예: 서버 내부 테스트) 허용
            if (allowedOriginsArray.indexOf(origin) !== -1 || !origin) {
                callback(null, true);
            } else {
                console.error(`[CORS] Check (Socket.IO): Origin ${origin} NOT allowed.`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});


// --- Socket.IO 이벤트 핸들러 초기화 ---
initializeSocket(io);

// --- Redis 리스너 시작 ---
redisClient.on('connect', () => {
    startRedisListener(redisClient, io);
});
redisClient.on('error', (err) => {
    console.error('[REDIS] Redis connection error detected in server.js:', err);
});


// --- 기본 라우트 및 서버 리슨 ---
app.get('/', (req, res) => {
    // 현재 실행 모드(HTTP/HTTPS)를 반영하도록 응답 메시지 수정
    res.send(`[APP] Node.js ${serverMode.toUpperCase()} Socket.IO Server is running.`);
});

// !!! 아래 PORT 변수 중복 정의 삭제됨 !!!
server.listen(PORT, () => {
    // 현재 실행 모드(HTTP/HTTPS)를 반영하도록 로그 메시지 수정
    console.log(`[START] Node.js ${serverMode.toUpperCase()} SocketIO Server listening on port ${PORT}`);
});


// --- 그레이스풀 셧다운 ---
process.on('SIGTERM', () => {
    console.log('[SYSTEM] SIGTERM signal received. Shutting down gracefully.');
    server.close(() => {
        console.log(`[SYSTEM] ${serverMode.toUpperCase()} server closed.`);
        redisClient.quit(() => {
            console.log('[SYSTEM] Redis client connection closed.');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('[SYSTEM] SIGINT signal received (Ctrl+C). Shutting down gracefully.');
    server.close(() => {
        console.log(`[SYSTEM] ${serverMode.toUpperCase()} server closed.`);
        redisClient.quit(() => {
            console.log('[SYSTEM] Redis client connection closed.');
            process.exit(0);
        });
    });
});