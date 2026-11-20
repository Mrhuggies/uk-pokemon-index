from playwright.sync_api import sync_playwright
import os
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
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1280,'height':800})
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.route('http://local.test/**',mk()); pg.route('**/fonts.googleapis.com/**',lambda r:r.abort()); pg.route('**/assets.tcgdex.net/**',lambda r:r.abort())
    pg.goto('http://local.test/'); pg.wait_for_timeout(1000); pg.keyboard.press('Enter')
    walk(pg,'ArrowLeft',10); walk(pg,'ArrowUp',3); pg.wait_for_timeout(600); walk(pg,'ArrowUp',5); pg.keyboard.press('Enter'); pg.wait_for_timeout(1000)
    print(pg.evaluate('IndexTown._debug()'), pg.eval_on_selector('#pcbody','e=>e.firstElementChild&&e.firstElementChild.id'))
    print('rows', pg.locator('#pcbody .row').count())
    pg.screenshot(path='/tmp/t8-home.png')
    pg.click('#pcbody .row >> nth=0'); pg.wait_for_timeout(700)
    print('drawer open', pg.evaluate("document.getElementById('dr').classList.contains('open')"))
    pg.screenshot(path='/tmp/t9-drawer.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    print('after esc: drawer', pg.evaluate("document.getElementById('dr').classList.contains('open')"), 'pc', pg.evaluate('IndexTown.isPC()'))
    b.close()
print('errors',errs)
