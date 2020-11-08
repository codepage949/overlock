import http from 'http';
import { uid } from 'uid';
import qs from 'querystring';
import url from 'url';

const mutexMap = new Map<string, [string, (http.ServerResponse | null)[]]>();

enum Mutex {
    KEY = 0,
    WAITINGS = 1,
}

export function startServer() {
    return new Promise<Function>((ok) => {
        const server = http.createServer((req, res) => {
            if (req.url === undefined) {
                // 재현하기가 까다로운 것 같음
                // 심각한 오류 상황이 아니라면 발생하지 않을 듯...?

                res.statusCode = 400;

                res.end();
            } else {
                const parsedUrl = url.parse(req.url);
                const pathname = parsedUrl.pathname!;
                const qry = parsedUrl.query!;

                if (req.method === 'GET') {
                    if (mutexMap.has(pathname) === false) {
                        const u = uid();

                        mutexMap.set(pathname, [u, []]);

                        res.statusCode = 200;

                        res.end(u);
                    } else {
                        const mutex = mutexMap.get(pathname)!;

                        mutex[Mutex.WAITINGS].push(res);

                        let done = false; // error 핸들러 다음 close 핸들러가 또 호출될 경우 중복 처리 방지용
                        const idx = mutex[Mutex.WAITINGS].length - 1;

                        const handleError = () => {
                            if (done === false) {
                                mutex[Mutex.WAITINGS][idx] = null;
                                done = true;
                            }
                        };

                        // key를 받기 전에 연결이 끊어진 대기자는 큐에서 null로 처리
                        res.on('error', handleError)
                            .on('close', handleError);
                    }
                } else if (req.method === 'PUT') {
                    if (mutexMap.has(pathname) === false) {
                        // 뮤텍스가 생성되지 않았을 경우

                        res.statusCode = 400;

                        res.end();
                    } else {
                        const mutex = mutexMap.get(pathname)!;

                        if (mutex[Mutex.KEY] in qs.parse(qry) === false) {
                            // 잘못된 key를 사용했을 경우

                            res.statusCode = 400;

                            res.end();
                        } else {
                            // 연결이 끊어지지 않고 큐에서 제일 앞에 있는 대기자의 index 찾기
                            const idx = (() => {
                                let idx = 0;

                                for (; idx < mutex[Mutex.WAITINGS].length; idx++) {
                                    if (mutex[Mutex.WAITINGS][idx] !== null) {
                                        return idx;
                                    }
                                }

                                return -1; // 대기자가 없음
                            })();

                            if (idx === -1) {
                                mutexMap.delete(pathname);
                            } else {
                                const res = mutex[Mutex.WAITINGS][idx]!;

                                mutex[Mutex.WAITINGS][idx] = null;

                                // key를 받고 정상적으로 연결이 끊어지는 경우이므로 'close' 오류 핸들러 제거
                                res.removeAllListeners('close');

                                res.statusCode = 200;

                                res.end(mutex[Mutex.KEY]);
                            }

                            res.statusCode = 200;

                            res.end();
                        }
                    }
                }
            }
        }).listen(process.env.PORT, () => {
            console.log(`listening on ${process.env.PORT}`);
            ok(() => {
                server.close();
            });
        });
    });
}