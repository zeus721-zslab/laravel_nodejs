// redisClient.js
const Redis = require('ioredis');

const redisOptions = {
    host: process.env.REDIS_HOST || 'laravel_redis', // 환경 변수 사용 권장
    port: process.env.REDIS_PORT || 6379,          // 환경 변수 사용 권장
    password: process.env.REDIS_PASSWORD || "", // 환경 변수 사용 권장
    family: 4,
    db: parseInt(process.env.REDIS_DB || '0', 10) // ★ DB 번호 설정 추가 (기본값 0)
};

const redisClient = new Redis(redisOptions);

console.log('redisOptions' , redisOptions);

redisClient.on('connect', () => {
    console.log('[STG] Redis 클라이언트가DB ${redisOptions.db}에 연결되었습니다.');
});
redisClient.on('ready', () => {
    // 연결 후 명령 실행 준비 완료 시
    console.log('[STG] Redis 클라이언트 준비 완료 (Ready).');
    // 여기서 구독을 시작하는 것이 더 안정적일 수 있습니다.
    // startRedisListener(redisClient, io); // 만약 여기서 호출한다면 server.js의 on('connect') 부분 제거
});

redisClient.on('reconnecting', () => {
    // 재연결 시도 시
    console.log('[STG] Redis 재연결 시도 중...');
});

redisClient.on('error', (err) => {
    console.error('[STG] Redis 연결 오류:', err);
    // 필요하다면 여기서 재연결 로직 등을 추가할 수 있습니다.
});

// 다른 파일에서 Redis 클라이언트 인스턴스를 사용할 수 있도록 내보냅니다.
module.exports = redisClient;
