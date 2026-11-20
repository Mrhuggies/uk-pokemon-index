from playwright.sync_api import sync_playwright
import os, json
errs=[]
def mk():
    def h(r):
        u=r.request.url.split('local.test/')[1].split('?')[0] or 'index.html'
        f=os.path.join('public',u)
        return r.fulfill(path=f) if os.path.isfile(f) else r.fulfill(status=404,body='')
    return h
def walk(pg, key, n):
    for _ in range(n):
        pg.keyboard.down(key); pg.wait_for_timeout(110); pg.keyboard.up(key); pg.wait_for_timeout(260)
dbg=lambda pg: pg.evaluate('IndexTown._debug()')
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={'width':1280,'height':800})
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.route('http://local.test/**',mk()); pg.route('**/fonts.googleapis.com/**',lambda r:r.abort()); pg.route('**/assets.tcgdex.net/**',lambda r:r.abort())
    pg.goto('http://local.test/'); pg.wait_for_timeout(1200)
    pg.screenshot(path='/tmp/t1-welcome.png')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    print('start', dbg(pg))
    walk(pg,'ArrowLeft',3); walk(pg,'ArrowUp',2); pg.wait_for_timeout(300)
    print('at stub', dbg(pg)); pg.screenshot(path='/tmp/t2-sign.png')
    walk(pg,'ArrowUp',1); pg.wait_for_timeout(700)
    print('inside', dbg(pg)); pg.screenshot(path='/tmp/t3-room.png')
    walk(pg,'ArrowUp',5); pg.wait_for_timeout(300)
    print('at pc', dbg(pg))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
    print('pc', dbg(pg), pg.eval_on_selector('#pcbody','e=>e.firstElementChild&&e.firstElementChild.id'))
    pg.screenshot(path='/tmp/t4-pc.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    print('closed', dbg(pg), 'sec-index back in body:', pg.evaluate("document.getElementById('sec-index').parentElement.tagName"))
    walk(pg,'ArrowDown',6); pg.wait_for_timeout(800)
    print('outside', dbg(pg))
    # go to town hall: door (28,14) stub (28,15). from (13,7): down 1 -> (13,8), right to 17? path rows 8-9; go right to col 17, down to row 16 via vertical path cols16-17, right to 28, up 1 to (28,15), up -> enter
    walk(pg,'ArrowDown',2); walk(pg,'ArrowRight',4); walk(pg,'ArrowDown',7); walk(pg,'ArrowRight',11); walk(pg,'ArrowUp',1); pg.wait_for_timeout(300)
    print('hall stub', dbg(pg))
    walk(pg,'ArrowUp',1); pg.wait_for_timeout(700); walk(pg,'ArrowUp',5); pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
    print('hall pc', dbg(pg)); pg.screenshot(path='/tmp/t5-settings.png')
    pg.click('#toClassic'); pg.wait_for_timeout(800)
    print('classic: town hidden', pg.evaluate("document.getElementById('town').hidden"), 'body class', pg.evaluate('document.body.className'), 'view', pg.evaluate("localStorage.getItem('view')"))
    pg.screenshot(path='/tmp/t6-classic.png')
    pg.close()
    # mobile
    pg=b.new_page(viewport={'width':390,'height':844}, has_touch=True, is_mobile=True)
    pg.on('pageerror',lambda e: errs.append('m:'+str(e)))
    pg.route('http://local.test/**',mk()); pg.route('**/fonts.googleapis.com/**',lambda r:r.abort()); pg.route('**/assets.tcgdex.net/**',lambda r:r.abort())
    pg.goto('http://local.test/'); pg.wait_for_timeout(1200)
    pg.screenshot(path='/tmp/t7-mobile.png')
    pg.close(); b.close()
print('errors', errs)
