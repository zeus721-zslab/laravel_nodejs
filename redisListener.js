// redisListener.js (읽음 처리 로직 추가)

// 기존 채널 이름
const IMAGE_PROCESSING_CHANNEL = 'laravel_database_image_processing_queue';
// ★ 새로 추가할 읽음 처리 이벤트 채널 이름 (Laravel MessageRead 이벤트와 일치)
const CHAT_READ_EVENTS_CHANNEL = 'laravel_database_chat-read-events'; // 이전 대화에서 정한 이름


function startRedisListener(redisClient, io) {
    // Redis 클라이언트 연결 확인 로직은 server.js 에서 이미 처리됨/
	//

    // 1. 기존 이미지 처리 채널 구독
    redisClient.subscribe(IMAGE_PROCESSING_CHANNEL, (err, count) => {
        if (err) {
            console.error(`[STG] Redis 채널 '${IMAGE_PROCESSING_CHANNEL}' 구독 오류:`, err);
            return;
        }
        console.log(`[STG] Redis 채널 '${IMAGE_PROCESSING_CHANNEL}' 구독 성공. 총 ${count}개 채널 구독 중.`);
    });

    // 2. ★ 읽음 처리 이벤트 채널 추가 구독 ★
    redisClient.subscribe(CHAT_READ_EVENTS_CHANNEL, (err, count) => {
        if (err) {
            console.error(`[STG] Redis 채널 '${CHAT_READ_EVENTS_CHANNEL}' 구독 오류:`, err);
            return;
        }
        console.log(`[STG] Redis 채널 '${CHAT_READ_EVENTS_CHANNEL}' 구독 성공. 총 ${count}개 채널 구독 중.`);
    });

    // 3. ★ 메시지 리스너 로직 수정: 채널별로 분기 처리 ★
    redisClient.on('message', (channel, message) => {

        // 3-1. 이미지 처리 채널 메시지 처리 (기존 로직 유지)
        if (channel === IMAGE_PROCESSING_CHANNEL) {
            try {
                const payload = JSON.parse(message);
                const filePathFromQueue = payload.path;
                const userId = payload.user_id;

                if (!userId || !filePathFromQueue) {
                    console.error('[STG] 이미지 처리 메시지에서 userId 또는 path를 찾을 수 없습니다:', payload);
                    return;
                }

                console.log('[STG] 큐에서 받은 이미지 처리 메시지:', payload);
                const targetRoomName = 'user_' + String(userId); // 사용자 Room 이름 규칙 확인

                // 기존 setTimeout 유지 (필요시 제거/수정)
                setTimeout(() => {
                    io.to(targetRoomName).emit('image_uploaded', { userId: userId, filePath: filePathFromQueue });
                    console.log(`[STG] 사용자 ${targetRoomName} 룸에 image_uploaded 이벤트 전송 완료`);
                }, 2000);

            } catch (error) {
                console.error('[STG] 이미지 처리 Redis 메시지 처리 중 오류 발생:', error, '원본 메시지:', message);
            }
        }
        // 3-2. ★ 읽음 처리 이벤트 채널 메시지 처리 ★
        else if (channel === CHAT_READ_EVENTS_CHANNEL) {
            try {
                const payload = JSON.parse(message);
                console.log('[STG] Redis에서 읽음 처리 이벤트 수신:', payload);

                // ★★★ 수정: payload.data 에서 데이터 추출 ★★★
                const eventData = payload.data; // data 객체를 먼저 가져옴
                if (!eventData) { // data 객체가 없는 경우 에러 처리
                     console.error('[STG] 이벤트 페이로드에 data 객체가 없습니다:', payload);
                     return;
                }

                // Laravel MessageRead 이벤트의 broadcastWith 에서 보낸 데이터 추출
                const { roomId, messageIds, readAt, recipientUserId } = eventData;
                // 필수 데이터 유효성 검사
                if (recipientUserId === undefined || !messageIds || !roomId) {
                    console.error('[STG] 읽음 처리 이벤트 데이터에 recipientUserId, messageIds 또는 roomId가 없습니다:', payload);
                    return;
                }

                // ★ 알림을 받을 사용자(메시지 원 발신자)의 Room 이름 생성
                //    (사용자별 Room 관리 방식이 동일하다고 가정)
                const targetUserRoom = 'user_' + String(recipientUserId);

                // ★ 해당 사용자 Room으로 'message.read' 이벤트 Emit
                //    (Laravel MessageRead 이벤트의 broadcastAs 이름과 일치)
                io.to(targetUserRoom).emit('message.read', { roomId, messageIds, readAt });
                console.log(`[STG] 사용자 ${targetUserRoom} 룸에 message.read 이벤트 전송 완료:`, { roomId, messageIds, readAt });

            } catch (error) {
                console.error('[STG] 읽음 처리 Redis 메시지 처리 중 오류 발생:', error, '원본 메시지:', message);
            }
        }
        // 다른 채널 리스너 필요 시 여기에 else if 추가
    });

    console.log(`[STG] Redis 채널 '${IMAGE_PROCESSING_CHANNEL}', '${CHAT_READ_EVENTS_CHANNEL}'에 대한 리스너가 설정되었습니다.`);
}

module.exports = { startRedisListener };
