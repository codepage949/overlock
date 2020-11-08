import time
from http.client import HTTPConnection
from threading import Thread

num = 0


def do_task(id):
    global num

    hc = HTTPConnection('127.0.0.1:5000', timeout=3600)

    hc.request('GET', '/lock')

    resp = hc.getresponse()
    key = resp.read().decode()

    hc.close()

    print('--start task: {}--'.format(id))

    num += 1

    print(num)
    time.sleep(0.5)

    print('--  end task: {}--'.format(id))

    hc = HTTPConnection('127.0.0.1:5000')

    hc.request('PUT', '/lock?{}'.format(key))
    hc.close()


def main():
    tasks = []

    for i in range(1, 6):
        tasks.append(Thread(target=do_task, args=('task{}'.format(i),)))

    for task in tasks:
        task.start()

    for task in tasks:
        task.join()


if __name__ == '__main__':
    main()
