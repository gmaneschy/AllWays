from .base import *

CORS_ALLOW_ALL_ORIGINS = True

# Throttle de cadastro/reenvio de ativação em base.py é pensado pra produção
# (anti-spam de verdade) — 5/hora e 3/hora travam rápido quando você tá
# testando o fluxo repetidamente. Só atualiza as chaves de throttle,
# mantendo o resto do REST_FRAMEWORK herdado do base.py intacto.
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'cadastro': '50/hour',
    'reenvio_ativacao': '30/hour',
}