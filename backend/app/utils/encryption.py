import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import settings


def _get_fernet() -> Fernet:
    """Derive a 32-byte Fernet key from the application encryption secret."""
    raw = settings.encryption_key.encode()
    digest = hashlib.sha256(raw).digest()
    url_safe_key = base64.urlsafe_b64encode(digest)
    return Fernet(url_safe_key)


def encrypt(plaintext: str) -> str:
    """Encrypt *plaintext* and return the ciphertext as a UTF-8 string."""
    fernet = _get_fernet()
    token = fernet.encrypt(plaintext.encode())
    return token.decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt *ciphertext* (produced by :func:`encrypt`) and return the original string."""
    fernet = _get_fernet()
    plaintext = fernet.decrypt(ciphertext.encode())
    return plaintext.decode()
