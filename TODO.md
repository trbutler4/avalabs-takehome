# Asset Registry Service - TODO

## Backend

- [ ] Ingest crypto networks from CoinGecko API
- [ ] Ingest tokens (assets) from CoinGecko API
- [ ] Rate limit CoinGecko calls (max 30/min)
- [ ] Store data in PostgreSQL

### API Endpoints

- [ ] `GET /networks` - list supported networks
- [ ] `GET /tokens?network_id=` - list tokens for network (paged)
- [ ] `GET /tokens?search=` - search tokens by address, symbol, name
- [ ] `GET /tokens?wallet=0x` - tokens with non-zero balances for wallet

## Frontend

- [ ] Display list of networks
- [ ] Display list of tokens/assets per network
- [ ] Wallet input field
- [ ] Show token balances for wallet

## Infrastructure

- [ ] Docker compose deployment

## Notes

- CoinGecko doesn't provide wallet balances - need separate provider (Alchemy, public RPC, etc.)
