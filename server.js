// server.js - Node.js 직접 HTTP/WS 처리 방식
require('dotenv').config();

const http = require('http'); // http 모듈 대신 https 사용
const { Server } = require("socket.io");
const express = require('express');
// const cors = require('cors'); // Express cors 미들웨어는 사용 안 함

// 분리된 모듈 가져오기 (원래대로 복구)
const redisClient = require('./redisClient');
const { initializeSocket } = require('./socketHandler');
const { startRedisListener } = require('./redisListener');

const app = express();

// --- ★ HTTP 서버 생성 ★ ---
const server = http.createServer(app); // http 서버 대신 https 서버 사용

// --- CORS 설정 (Socket.IO 옵션 사용 - 함수 방식) ---
const corsOriginString = process.env.CORS_ORIGIN || '';
const allowedOriginsArray = corsOriginString.split(',').map(origin => origin.trim()).filter(origin => origin);
console.log("[STG] Allowed CORS Origins Array (for Socket.IO options):", allowedOriginsArray);

const io = new Server(server, { // 'server' 변수는 이제 https 서버
    cors: {
        origin: function (origin, callback) {
            // console.log(`CORS Check (Socket.IO): Request Origin = ${origin}`); // 필요시 로그 활성화
            if (allowedOriginsArray.indexOf(origin) !== -1 || !origin) {
                callback(null, true); // 허용
            } else {
                console.error(`[STG] CORS Check (Socket.IO): Origin ${origin} NOT allowed.`);
                callback(new Error('Not allowed by CORS')); // 거부
            }
        },
        methods: ["GET", "POST"],
        credentials: true // credentials 설정 유지
    },
    transports: ['websocket', 'polling'] // 기본 전송 방식
});
// --- CORS 설정 끝 ---


// --- Socket.IO 이벤트 핸들러 초기화 (원래대로 복구) ---
initializeSocket(io);
// 임시 기본 핸들러는 제거합니다.
// io.of("/").on("connection", ...);
// --- Socket.IO 이벤트 핸들러 끝 ---


// --- Redis 리스너 시작 (원래대로 복구) ---
redisClient.on('connect', () => {
    // console.log('Redis 클라이언트가 연결되었습니다.'); // redisClient.js 에 로그가 있다면 중복될 수 있음
    startRedisListener(redisClient, io);
    // 다른 리스너 추가 가능
});

redisClient.on('error', (err) => {
    console.error('[STG] Staging 서버 파일에서 Redis 연결 오류 감지:', err);
});
// --- Redis 관련 로직 끝 ---


// --- 기본 라우트 및 서버 리슨 ---
app.get('/', (req, res) => {
  // 응답 메시지 변경
  res.send('[STG] Node.js HTTP Socket.IO 서버가 실행 중입니다.');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    // 로그 메시지 변경
    console.log(`[STG] Node.js HTTP SocketIO 서버가 포트 ${PORT}에서 시작되었습니다...`);
});
// --- 기본 라우트 및 서버 리슨 끝 ---


// --- 그레이스풀 셧다운 ---
process.on('SIGTERM', () => {
    console.log('[STG] SIGTERM 신호 수신. 서버를 종료합니다.');
    server.close(() => {
        console.log('[STG] HTTP 서버가 닫혔습니다.');
        redisClient.quit(() => {
            console.log('[STG] Redis 연결이 종료되었습니다.');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('[STG] SIGINT 신호 수신 (Ctrl+C). 서버를 종료합니다.');
    server.close(() => {
        console.log('[STG] HTTP 서버가 닫혔습니다.');
        redisClient.quit(() => {
            console.log('[STG] Redis 연결이 종료되었습니다.');
            process.exit(0);
        });
    });
});
// --- 그레이스풀 셧다운 끝 ---
