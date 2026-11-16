from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=5)
def send_email_task(subject: str, body: str, recipients: list[str]) -> None:
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, recipients)
