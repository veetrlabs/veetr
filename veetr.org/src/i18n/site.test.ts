import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localizedPath,siteLanguage,unlocalizedPath,accountCallbackPath,localizedAccountReturn} from './site';
test('language paths preserve deep routes without translating IDs or parameters',()=>{
 for (const path of ['/','/docs/native-apps/','/races/?series=regata&event=123#tracking','/boats/avenir/','/join/abc/','/account/?invite=token']) {
  const translated=localizedPath(path,'cs');
  assert.equal(siteLanguage(translated),'cs');
  assert.equal(localizedPath(translated,'cs'),translated);
  assert.equal(unlocalizedPath(translated),path);
  assert.equal(localizedPath(translated,'en'),path);
 }
 assert.equal(localizedPath('/cs','en'),'/');
 assert.equal(siteLanguage('/css/main.css'),'en');
 assert.equal(localizedPath('https://app.veetr.org/','cs'),'https://app.veetr.org/');
 assert.equal(localizedPath('//example.org','cs'),'//example.org');
 const url=new URL('https://veetr.org/races/?series=regata&event=123#tracking');
 url.pathname=localizedPath(url.pathname,'cs');
 assert.equal(url.href,'https://veetr.org/cs/races/?series=regata&event=123#tracking');
});

test('account callback retains language, invitation and recovery fragment on the same origin',()=>{
 assert.equal(accountCallbackPath('en'),'/account/');
 assert.equal(accountCallbackPath('cs','boat-token'),'/account/?lang=cs&invite=boat-token');
 const input=new URL('https://veetr.org/account/?lang=cs&invite=boat-token#access_token=test&type=recovery');
 assert.equal(localizedAccountReturn(input),'/cs/account/?invite=boat-token#access_token=test&type=recovery');
 assert.equal(input.pathname,'/account/');
 assert.equal(localizedAccountReturn(new URL('https://veetr.org/account/?lang=https://example.com')),null);
 assert.equal(localizedAccountReturn(new URL('https://veetr.org/races/?lang=cs')),null);
 assert.equal(localizedAccountReturn(new URL('https://veetr.org/cs/account/')),null);
});
