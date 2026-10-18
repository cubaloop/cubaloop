import hashlib
import hmac
import json
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from backend.app import create_app
from backend import billing

ORIGIN = {'origin':'http://127.0.0.1:8765'}

@pytest.fixture
def setup(tmp_path):
    app=create_app(tmp_path)
    c=TestClient(app,headers=ORIGIN)
    r=c.post('/api/auth/register',json={'email':'one@example.com','password':'long-enough-password'})
    assert r.status_code==200
    return c,app,tmp_path


def lead_project(c):
    lead=c.post('/api/leads',json={'name':'Oliva Studio','sector':'Design'})
    assert lead.status_code==201
    p=c.post('/api/projects',params={'lead_id':lead.json()['id']})
    assert p.status_code==201
    return p.json()['id']


def test_approval_workflow_and_persistence(setup):
    c,app,path=setup
    p=lead_project(c)
    assert c.post(f'/api/projects/{p}/approve',json={'confirmed':True}).status_code==409
    assert c.post(f'/api/projects/{p}/contacted',json={'confirmed':True}).status_code==409
    proposal=c.post(f'/api/generate/{p}',json={}).json()['proposal']
    assert 'AED 1,000' in proposal
    assert c.put(f'/api/projects/{p}/draft',json={'proposal':proposal,'demo_url':'https://example.com/demo'}).status_code==200
    assert c.post(f'/api/projects/{p}/approve',json={'confirmed':False}).status_code==422
    assert c.post(f'/api/projects/{p}/approve',json={'confirmed':True}).status_code==200
    assert c.put(f'/api/projects/{p}/draft',json={'proposal':'Changed after approval','demo_url':'https://example.com'}).status_code==409
    assert c.post(f'/api/projects/{p}/contacted',json={'confirmed':True}).status_code==200
    restarted=TestClient(create_app(path),headers=ORIGIN)
    assert restarted.post('/api/auth/login',json={'email':'one@example.com','password':'long-enough-password'}).status_code==200
    assert restarted.get('/api/state').json()['projects'][0]['status']=='contacted'
    assert len(restarted.get('/api/state').json()['audit'])==4


def test_tenant_isolation(setup):
    first,app,path=setup
    p=lead_project(first)
    second=TestClient(app,headers=ORIGIN)
    second.post('/api/auth/register',json={'email':'two@example.com','password':'long-enough-password'})
    assert second.get('/api/state').json()['leads']==[]
    assert second.post('/api/projects?lead_id=1').status_code==404
    assert second.put(f'/api/projects/{p}/draft',json={'proposal':'Malicious replacement','demo_url':'https://example.com'}).status_code==409
    assert second.post(f'/api/projects/{p}/approve',json={'confirmed':True}).status_code==409
    assert 'Oliva Studio' not in second.get('/api/export').text
    assert first.get('/api/state').json()['projects'][0]['status']=='drafting'


def test_only_one_active_even_concurrently(setup):
    c,_,_=setup
    lid=c.post('/api/leads',json={'name':'A'}).json()['id']
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda _:c.post(f'/api/projects?lead_id={lid}').status_code,range(4)))
    assert sorted(results)==[201,409,409,409]


def test_security_and_logout(setup):
    c,app,_=setup
    assert TestClient(app).get('/api/state').status_code==401
    assert c.post('/api/leads',headers={'origin':'https://evil.example'},json={'name':'A'}).status_code==403
    assert c.get('/api/state',headers={'host':'evil.example'}).status_code==403
    assert c.post('/api/auth/login',json={'email':'one@example.com','password':'wrong-password-123'}).status_code==401
    assert c.post('/api/logout').status_code==200
    assert c.get('/api/state').status_code==401


def test_trial_expiry_keeps_export(setup):
    c,_,path=setup
    lead_project(c)
    with sqlite3.connect(path/'accounts.db') as db:
        db.execute('UPDATE users SET trial_until=0')
    assert c.get('/api/state').status_code==200
    assert c.get('/api/export').status_code==200
    assert c.post('/api/leads',json={'name':'B'}).status_code==402
    assert c.get('/api/me').json()['entitled'] is False


def test_groq_requires_consent_and_configuration(setup,monkeypatch):
    c,_,_=setup
    p=lead_project(c)
    monkeypatch.delenv('GROQ_API_KEY',raising=False)
    assert c.post(f'/api/generate/{p}',json={}).json()['source']=='template'
    assert c.post(f'/api/generate/{p}',json={'share_with_groq':True}).status_code==503


def test_csv_formula_protection(setup):
    c,_,_=setup
    c.post('/api/leads',json={'name':'=1+1','phone':'+971000000'})
    export=c.get('/api/export').text
    assert "'=1+1" in export and "'+971000000" in export


def test_billing_configuration_and_signature(setup,monkeypatch):
    c,_,_=setup
    monkeypatch.delenv('STRIPE_SECRET_KEY',raising=False)
    monkeypatch.delenv('STRIPE_PRO_PRICE_ID',raising=False)
    monkeypatch.setenv('STRIPE_WEBHOOK_SECRET','whsec_testing')
    assert c.post('/api/billing/checkout',json={'plan':'pro'}).status_code==503
    assert c.post('/api/billing/webhook',content='{}',headers={'stripe-signature':'invalid'}).status_code==400


def test_verified_webhook_sets_access_idempotently(setup,monkeypatch):
    c,_,path=setup
    monkeypatch.setenv('STRIPE_WEBHOOK_SECRET','whsec_testing')
    with sqlite3.connect(path/'accounts.db') as db:
        db.execute("UPDATE users SET stripe_customer='cus_test',trial_until=0")
    class Subscription(dict):
        def __getattr__(self,key):return self[key]
    current=Subscription(id='sub_test',status='active',customer='cus_test',items={'data':[{'price':{'id':'price_pro'}}]})
    monkeypatch.setenv('STRIPE_PRO_PRICE_ID','price_pro')
    monkeypatch.setattr(billing,'client',lambda:SimpleNamespace(v1=SimpleNamespace(subscriptions=SimpleNamespace(retrieve=lambda _:current))))
    payload=json.dumps({'id':'evt_test','object':'event','type':'customer.subscription.updated','data':{'object':{'id':'sub_test','customer':'cus_test','status':'past_due'}}})
    timestamp=int(time.time())
    sig=hmac.new(b'whsec_testing',f'{timestamp}.{payload}'.encode(),hashlib.sha256).hexdigest()
    headers={'stripe-signature':f't={timestamp},v1={sig}'}
    for _ in range(2):
        assert c.post('/api/billing/webhook',content=payload,headers=headers).status_code==200
    assert c.get('/api/me').json()['status']=='active'
    assert c.get('/api/me').json()['entitled'] is True
    with sqlite3.connect(path/'accounts.db') as db:
        assert db.execute('SELECT count(*) FROM events').fetchone()[0]==1


def test_checkout_uses_server_price(setup,monkeypatch):
    c,_,_=setup
    monkeypatch.setenv('STRIPE_PRO_PRICE_ID','price_configured')
    captured={}
    def create_customer(**kw):return SimpleNamespace(id='cus_new')
    def create_session(**kw):
        captured.update(kw['params'])
        return SimpleNamespace(url='https://checkout.stripe.com/test')
    monkeypatch.setattr(billing,'client',lambda:SimpleNamespace(v1=SimpleNamespace(prices=SimpleNamespace(retrieve=lambda _:SimpleNamespace(currency='aed',unit_amount=99900,recurring=SimpleNamespace(interval='day',interval_count=30))),customers=SimpleNamespace(create=create_customer),subscriptions=SimpleNamespace(list=lambda **kw:SimpleNamespace(data=[])),checkout=SimpleNamespace(sessions=SimpleNamespace(create=create_session,list=lambda **kw:SimpleNamespace(data=[]))))))
    assert c.post('/api/billing/checkout',json={'plan':'pro'}).json()['url'].startswith('https://checkout.stripe.com/')
    assert captured['line_items']==[{'price':'price_configured','quantity':1}]
    assert captured['mode']=='subscription'


def test_groq_shares_only_selected_fields(setup,monkeypatch):
    c,_,_=setup
    lid=c.post('/api/leads',json={'name':'Oliva','sector':'Design','notes':'private note','email':'private@example.com','phone':'123'}).json()['id']
    p=c.post(f'/api/projects?lead_id={lid}').json()['id']
    monkeypatch.setenv('GROQ_API_KEY','testing-only')
    captured={}
    class Response:
        def raise_for_status(self):pass
        def json(self):return {'choices':[{'message':{'content':'Professional proposal from test'}}]}
    class Client:
        def __init__(self,**kw):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def post(self,url,**kw):
            captured.update(kw['json'])
            return Response()
    monkeypatch.setattr('backend.app.httpx.AsyncClient',Client)
    response=c.post(f'/api/generate/{p}',json={'share_with_groq':True})
    assert response.json()['source']=='groq'
    text=json.dumps(captured)
    assert 'Oliva' in text and 'Design' in text
    assert 'private note' not in text and 'private@example.com' not in text


def test_missing_origin_rejected_and_https_health(tmp_path,monkeypatch):
    monkeypatch.setenv('APP_URL','https://jota.example')
    app=create_app(tmp_path)
    c=TestClient(app,base_url='https://jota.example')
    assert c.post('/api/auth/register',json={'email':'a@example.com','password':'long-enough-password'}).status_code==403
    r=c.post('/api/auth/register',headers={'origin':'https://jota.example'},json={'email':'a@example.com','password':'long-enough-password'})
    assert r.status_code==200 and 'Secure' in r.headers['set-cookie']
    assert c.get('/healthz',headers={'host':'127.0.0.1:8765'}).status_code==200
    assert c.get('/api/state',headers={'host':'127.0.0.1:8765'}).status_code==403
