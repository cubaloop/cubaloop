PLANS = {
    'pro': {'name':'Pro','amount_aed':999,'messages':300,'days':30,'price_env':'STRIPE_PRO_PRICE_ID'},
    'premium': {'name':'Premium','amount_aed':1499,'messages':700,'days':30,'price_env':'STRIPE_PREMIUM_PRICE_ID'},
}

def public_plans():
    return [{k:v for k,v in plan.items() if k != 'price_env'} | {'id':key} for key,plan in PLANS.items()]
