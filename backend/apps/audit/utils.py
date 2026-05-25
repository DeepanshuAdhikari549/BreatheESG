from .models import AuditLog

def log_action(request, entity_type, entity_id, action, diff=None):
    if diff is None:
        diff = {}
    
    organisation = getattr(request, 'organisation', None)
    actor = getattr(request, 'user', None)
    
    actor_email = ""
    if actor and actor.is_authenticated:
        actor_email = actor.email
    else:
        actor = None
        
    # Attempt to extract IP address
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip_address = x_forwarded_for.split(',')[0].strip()
    else:
        ip_address = request.META.get('REMOTE_ADDR')
        
    user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
    
    return AuditLog.objects.create(
        organisation=organisation,
        actor=actor,
        actor_email=actor_email,
        entity_type=entity_type,
        entity_id=str(entity_id),
        action=action,
        diff=diff,
        ip_address=ip_address,
        user_agent=user_agent
    )

def log_action_system(organisation, entity_type, entity_id, action, diff=None):
    if diff is None:
        diff = {}
    return AuditLog.objects.create(
        organisation=organisation,
        actor=None,
        actor_email="system@breatheesg.com",
        entity_type=entity_type,
        entity_id=str(entity_id),
        action=action,
        diff=diff,
        ip_address="127.0.0.1",
        user_agent="System Execution"
    )
