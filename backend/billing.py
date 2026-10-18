import os
import stripe
from fastapi import HTTPException
from backend.plans import PLANS


def client():
    key = os.environ.get('STRIPE_SECRET_KEY')
    if not key:
        raise HTTPException(503, 'Los pagos todavía no están configurados.')
    return stripe.StripeClient(key)


def checkout(user, accounts, app_url, plan_id):
    plan = PLANS[plan_id]
    price = os.environ.get(plan['price_env'])
    if not price:
        raise HTTPException(503, 'Falta configurar el plan de Stripe.')
    api = client()
    configured = api.v1.prices.retrieve(price)
    recurrence = configured.recurring
    if configured.currency != 'aed' or configured.unit_amount != plan['amount_aed'] * 100 or not recurrence or recurrence.interval != 'day' or recurrence.interval_count != 30:
        raise HTTPException(503, 'El precio de Stripe no coincide con el plan anunciado de 30 días.')
    with accounts.db() as db:
        # Serialize customer creation to prevent duplicate customers on concurrent requests.
        db.execute('BEGIN IMMEDIATE')
        current = db.execute('SELECT * FROM users WHERE id=?',(user['id'],)).fetchone()
        if current['status'] in ('active','trialing'):
            raise HTTPException(409, 'Ya tienes una suscripción. Usa Gestionar plan.')
        customer = current['stripe_customer']
        if not customer:
            customer = api.v1.customers.create(params={'email':user['email'],'metadata':{'user_id':user['id']}}, options={'idempotency_key':'customer-'+user['id']}).id
            db.execute('UPDATE users SET stripe_customer=? WHERE id=?',(customer,user['id']))
    with accounts.db() as db:
        db.execute('BEGIN IMMEDIATE')
        # Reuse an open Checkout session instead of creating parallel subscriptions.
        subscriptions = api.v1.subscriptions.list(params={'customer':customer,'limit':100})
        if any(s.status in ('active','trialing','past_due','unpaid','paused') for s in subscriptions.data):
            raise HTTPException(409, 'Ya existe una suscripción. Usa Gestionar plan.')
        sessions = api.v1.checkout.sessions.list(params={'customer':customer,'status':'open','limit':10})
        for session in sessions.data:
            if session.mode == 'subscription':
                return {'url':session.url}
        session = api.v1.checkout.sessions.create(params={
            'customer':customer,'mode':'subscription','line_items':[{'price':price,'quantity':1}],
            'success_url':app_url+'/?billing=success','cancel_url':app_url+'/?billing=cancelled',
            'client_reference_id':user['id'],
        })
        return {'url':session.url}



def webhook(payload, signature, accounts):
    secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
    if not secret:
        raise HTTPException(503,'Webhook sin configurar.')
    try:
        event = stripe.Webhook.construct_event(payload, signature, secret)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(400,'Firma de Stripe inválida.')
    with accounts.db() as db:
        db.execute('BEGIN IMMEDIATE')
        if db.execute('SELECT id FROM events WHERE id=?',(event.id,)).fetchone():
            return {'received':True}
        if event.type in ('customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'):
            obj = event.data.object
            # Read authoritative current state while serialized against other webhooks.
            subscription = client().v1.subscriptions.retrieve(obj.id)
            price_id = subscription['items']['data'][0]['price']['id']
            plan_id = next((key for key,value in PLANS.items() if os.environ.get(value['price_env']) == price_id), None)
            if not plan_id:
                raise HTTPException(409, 'La suscripción usa un precio no configurado.')
            db.execute('UPDATE users SET status=?,stripe_subscription=?,plan=? WHERE stripe_customer=?',
                (subscription.status,subscription.id,plan_id,subscription.customer))
        db.execute('INSERT INTO events VALUES(?)',(event.id,))
    return {'received':True}
