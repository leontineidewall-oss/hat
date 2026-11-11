# hat

Keep your pfp. Add the coin's hat. Everyone wearing it splits the fees, by holdings.

Static page (index.html) plus Vercel functions in api/. The hat's band carries a 30-cell code: 24 bits from the wallet's SHA-256 and 6 check bits. api/_code.js reads it back from an X picture.

## Environment (Vercel, Settings, Environment Variables)

| name | what |
|---|---|
| HAT_MINT | the $HAT contract address |
| FEE_WALLET | the wallet that receives creator fees and pays the wearers |
| RPC_URL | a Solana RPC (Helius, Triton, QuickNode) |
| KV_REST_API_URL, KV_REST_API_TOKEN | the wearers list: add a Redis store from the Vercel Marketplace (Upstash names also work) |
| X_BEARER_TOKEN | optional, reads X pictures through the X API; without it the site uses unavatar.io |
| ROUND_KEY | a secret for running a round |
| HAT_MIN | optional, the floor in $HAT (default 100000) |
| HAT_EVERY_HOURS | optional, 1 to 24 (default 24) |

## Routes

- /api/config: mint, fee wallet, floor, round length, what is connected
- /api/check?handle=&wallet=: reads the wallet and the X picture; adds the wearer to the list
- /api/roll: the wearers list and the last round
- /api/round (header x-round-key): checks every wearer again and returns who gets what from the fee wallet
- /api/vault: fee wallet balance and its last 30 transactions
- /api/market: price and market cap from DexScreener
