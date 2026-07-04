-- =============================================================================
-- Migration 001: Initial schema for PayTrace AI
--
-- This schema is kept in sync with the SQLAlchemy ORM models in app/models/.
-- The application also builds the same schema on startup via
-- Base.metadata.create_all (see app/database.create_tables); running this
-- migration produces an identical schema so both paths agree.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Utility: auto-update updated_at on every row change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Enum types (must match the Python enums in app/models/)
-- ---------------------------------------------------------------------------
CREATE TYPE payout_status AS ENUM
    ('pending', 'in_transit', 'paid', 'failed', 'canceled');

CREATE TYPE reconciliation_status AS ENUM
    ('unreconciled', 'in_progress', 'reconciled', 'needs_review');

CREATE TYPE payout_item_type AS ENUM
    ('payment', 'refund', 'stripe_fee', 'adjustment', 'chargeback', 'fx_adjustment');

CREATE TYPE job_status AS ENUM
    ('queued', 'running', 'completed', 'failed', 'needs_review');

CREATE TYPE evidence_type AS ENUM
    ('stripe_transaction', 'xero_invoice', 'xero_payment', 'bank_transaction');

-- ---------------------------------------------------------------------------
-- users
-- Stores application accounts. Passwords are bcrypt-hashed before storage.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID            DEFAULT gen_random_uuid() NOT NULL,
    email           VARCHAR(255)    NOT NULL,
    hashed_password VARCHAR(255)    NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ix_users_email ON users (email);

COMMENT ON TABLE users IS
    'Application user accounts. hashed_password stores a bcrypt digest; plain-text passwords are never persisted.';

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- xero_connections
-- Encrypted OAuth 2.0 tokens for a user's Xero tenant.
-- ---------------------------------------------------------------------------
CREATE TABLE xero_connections (
    id                  UUID            DEFAULT gen_random_uuid() NOT NULL,
    user_id             UUID            NOT NULL,
    tenant_id           VARCHAR(255)    NOT NULL,
    tenant_name         VARCHAR(255)    NOT NULL,
    access_token        VARCHAR(4096)   NOT NULL,   -- Fernet-encrypted
    refresh_token       VARCHAR(4096)   NOT NULL,   -- Fernet-encrypted
    token_expires_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    scopes              VARCHAR(1024)   NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_xero_user_tenant UNIQUE (user_id, tenant_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_xero_connections_user_id ON xero_connections (user_id);

COMMENT ON TABLE xero_connections IS
    'Xero OAuth 2.0 credentials per user per tenant. Token columns store Fernet-encrypted values.';

CREATE TRIGGER trg_xero_connections_updated_at
    BEFORE UPDATE ON xero_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- payouts
-- Stripe payout records synced from the Stripe API.
-- ---------------------------------------------------------------------------
CREATE TABLE payouts (
    id                      UUID            DEFAULT gen_random_uuid() NOT NULL,
    user_id                 UUID            NOT NULL,
    stripe_payout_id        VARCHAR(255)    NOT NULL,
    stripe_account_id       VARCHAR(255),
    amount                  NUMERIC(12, 2)  NOT NULL,
    currency                VARCHAR(3)      NOT NULL,
    status                  payout_status   NOT NULL,
    arrival_date            DATE            NOT NULL,
    description             TEXT,
    xero_bank_transaction_id VARCHAR(255),
    reconciliation_status   reconciliation_status NOT NULL DEFAULT 'unreconciled',
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE (stripe_payout_id)
);
CREATE INDEX ix_payouts_user_id ON payouts (user_id);
CREATE INDEX ix_payouts_user_arrival_date ON payouts (user_id, arrival_date);
CREATE INDEX ix_payouts_user_recon_status ON payouts (user_id, reconciliation_status);

COMMENT ON TABLE payouts IS
    'Stripe payout records with reconciliation lifecycle tracking. amount uses NUMERIC(12,2) to avoid floating-point drift.';

CREATE TRIGGER trg_payouts_updated_at
    BEFORE UPDATE ON payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- payout_items
-- Individual balance transactions that make up a payout.
-- ---------------------------------------------------------------------------
CREATE TABLE payout_items (
    id                              UUID            DEFAULT gen_random_uuid() NOT NULL,
    payout_id                       UUID            NOT NULL,
    stripe_balance_transaction_id   VARCHAR(255)    NOT NULL,
    type                            payout_item_type NOT NULL,
    amount                          NUMERIC(12, 2)  NOT NULL,
    currency                        VARCHAR(3)      NOT NULL,
    description                     TEXT,
    stripe_charge_id                VARCHAR(255),
    xero_invoice_id                 VARCHAR(255),
    xero_invoice_number             VARCHAR(255),
    matched_at                      TIMESTAMP WITH TIME ZONE,
    metadata                        JSONB,
    created_at                      TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at                      TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (payout_id) REFERENCES payouts (id) ON DELETE CASCADE,
    UNIQUE (stripe_balance_transaction_id)
);
CREATE INDEX ix_payout_items_payout_id ON payout_items (payout_id);
CREATE INDEX ix_payout_items_payout_type ON payout_items (payout_id, type);

COMMENT ON TABLE payout_items IS
    'Stripe balance transactions that compose a payout. Each row is one txn; amounts in NUMERIC(12,2).';

CREATE TRIGGER trg_payout_items_updated_at
    BEFORE UPDATE ON payout_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- reconciliation_jobs
-- AI agent reconciliation runs against a payout.
-- ---------------------------------------------------------------------------
CREATE TABLE reconciliation_jobs (
    id                      UUID            DEFAULT gen_random_uuid() NOT NULL,
    payout_id               UUID            NOT NULL,
    status                  job_status      NOT NULL DEFAULT 'queued',
    started_at              TIMESTAMP WITH TIME ZONE,
    completed_at            TIMESTAMP WITH TIME ZONE,
    agent_model             VARCHAR(255),
    agent_reasoning         TEXT,
    items_matched           INTEGER,
    items_unmatched         INTEGER,
    total_explained         NUMERIC(12, 2),
    total_unexplained       NUMERIC(12, 2),
    journal_entries_created JSONB,
    explanation_json        JSONB,
    error_message           TEXT,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (payout_id),
    FOREIGN KEY (payout_id) REFERENCES payouts (id) ON DELETE CASCADE
);
CREATE INDEX ix_reconciliation_jobs_status ON reconciliation_jobs (status);

COMMENT ON TABLE reconciliation_jobs IS
    'AI agent runs that match Stripe payout items to Xero accounts and create journal entries. One job per payout.';

-- ---------------------------------------------------------------------------
-- reconciliation_evidence
-- Supporting artefacts gathered during a reconciliation run.
-- ---------------------------------------------------------------------------
CREATE TABLE reconciliation_evidence (
    id              UUID            DEFAULT gen_random_uuid() NOT NULL,
    job_id          UUID            NOT NULL,
    claim           TEXT            NOT NULL,
    evidence_type   evidence_type   NOT NULL,
    evidence_id     VARCHAR(255)    NOT NULL,
    evidence_url    VARCHAR(1024),
    amount          NUMERIC(12, 2),
    verified        BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (job_id) REFERENCES reconciliation_jobs (id) ON DELETE CASCADE
);
CREATE INDEX ix_reconciliation_evidence_job_id ON reconciliation_evidence (job_id);

COMMENT ON TABLE reconciliation_evidence IS
    'Evidence artefacts collected by the AI agent during a reconciliation job, each tied to a specific claim.';

-- ---------------------------------------------------------------------------
-- audit_logs
-- Immutable append-only history of all significant system actions.
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id              UUID            DEFAULT gen_random_uuid() NOT NULL,
    user_id         UUID,
    action          VARCHAR(100)    NOT NULL,
    entity_type     VARCHAR(50)     NOT NULL,
    entity_id       UUID,
    before_state    JSONB,
    after_state     JSONB,
    agent_job_id    UUID,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    timestamp       TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX ix_audit_logs_action ON audit_logs (action);
CREATE INDEX ix_audit_logs_timestamp ON audit_logs (timestamp);

COMMENT ON TABLE audit_logs IS
    'Immutable audit trail. Rows are never updated or deleted; before_state/after_state capture JSON snapshots of changed state.';
