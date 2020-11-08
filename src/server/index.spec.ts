import dotenv from 'dotenv';

dotenv.config();

import { startServer } from './index';
import assert from 'assert';
import http from 'http';

let closeServer!: Function;

before(async function() {
    closeServer = await startServer();
});

after(function() {
    closeServer();
});

describe('scean1', function() {
    let key!: string;

    it('get on /lock and then immediately put /lock', function(done) {
        const req = http.request('http://127.0.0.1:5000/lock');

        req.on('response', (res) => {
            let buf = Buffer.from([]);

            assert.strictEqual(res.statusCode, 200);

            res.on('data', (chunk: Buffer) => {
                buf = Buffer.concat([buf, chunk]);
            }).on('end', () => {
                assert.ok(buf.length !== 0);

                key = buf.toString();

                const req = http.request(`http://127.0.0.1:5000/lock?${key}`, { method: 'PUT' });

                req.on('response', (res) => {
                    assert.strictEqual(res.statusCode, 200);
                    done();
                });
                req.end();
            });
        });

        req.end();
    });

    it('get on /lock', function(done) {
        const req = http.request('http://127.0.0.1:5000/lock');

        req.on('response', (res) => {
            let buf = Buffer.from([]);

            assert.strictEqual(res.statusCode, 200);

            res.on('data', (chunk: Buffer) => {
                buf = Buffer.concat([buf, chunk]);
            }).on('end', () => {
                assert.ok(buf.length !== 0);

                key = buf.toString();

                done();
            });
        });

        req.end();
    });

    it('get on /lock twice more and put on /lock after 1s, 2s, 3s', function(done) {
        this.timeout(10000);

        const req1 = http.request('http://127.0.0.1:5000/lock');
        const req2 = http.request('http://127.0.0.1:5000/lock');

        const handleResponse = (res: http.IncomingMessage) => {
            let buf = Buffer.from([]);

            assert.strictEqual(res.statusCode, 200);

            res.on('data', (chunk: Buffer) => {
                buf = Buffer.concat([buf, chunk]);
            }).on('end', () => {
                assert.strictEqual(buf.toString(), key);
            });
        }

        req1.on('response', handleResponse).end();
        req2.on('response', handleResponse).end();

        let cnt = 0;

        for (const time of [1000, 2000, 3000]) {
            setTimeout(() => {
                const req = http.request(`http://127.0.0.1:5000/lock?${key}`, { method: 'PUT' });

                req.on('response', (res) => {
                    assert.strictEqual(res.statusCode, 200);

                    cnt += 1;

                    if (cnt === 3) {
                        done();
                    }
                });
                req.end();
            }, time);
        }
    });
});