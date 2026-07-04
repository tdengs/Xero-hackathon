from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/paytrace",
        description="PostgreSQL connection string (asyncpg driver)",
    )

    # Redis
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL",
    )

    # Xero OAuth2
    xero_client_id: str = Field(description="Xero OAuth2 client ID")
    xero_client_secret: str = Field(description="Xero OAuth2 client secret")
    xero_redirect_uri: str = Field(description="Xero OAuth2 redirect URI")
    xero_scopes: str = Field(
        default="openid profile email accounting.banktransactions accounting.invoices accounting.manualjournals accounting.contacts offline_access",
        description="Space-separated Xero OAuth2 scopes",
    )

    # Stripe
    stripe_api_key: str = Field(description="Stripe secret API key")
    stripe_webhook_secret: str = Field(description="Stripe webhook signing secret")

    # Anthropic / Claude
    anthropic_api_key: str = Field(description="Anthropic API key")
    anthropic_model: str = Field(
        default="claude-sonnet-4-6",
        description="Claude model identifier",
    )

    # Application security
    secret_key: str = Field(
        min_length=32,
        description="Secret key used for JWT signing and session encryption (min 32 chars)",
    )
    encryption_key: str = Field(
        min_length=32,
        description="Fernet-compatible encryption key for sensitive data at rest (min 32 chars)",
    )

    # Runtime
    environment: str = Field(
        default="development",
        description="Deployment environment: development | staging | production",
    )
    log_level: str = Field(
        default="INFO",
        description="Python logging level",
    )

    # CORS
    cors_origins: list[str] = Field(
        default=["http://localhost:5173"],
        description="List of allowed CORS origins",
    )

    # Frontend
    frontend_dashboard_url: str = Field(
        default="http://localhost:5173",
        description="URL to redirect to after successful Xero OAuth callback",
    )


settings = Settings()
