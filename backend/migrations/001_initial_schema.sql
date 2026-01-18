CREATE TABLE networks (
  id TEXT PRIMARY KEY,
  chain_id INTEGER,
  name TEXT NOT NULL,
  native_coin_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tokens (
  id TEXT NOT NULL,
  network_id TEXT NOT NULL REFERENCES networks(id),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  contract_address TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, network_id)
);

CREATE INDEX idx_tokens_network ON tokens(network_id);
CREATE INDEX idx_tokens_symbol ON tokens(symbol);
CREATE INDEX idx_tokens_name ON tokens(name);
CREATE INDEX idx_tokens_address ON tokens(contract_address);
