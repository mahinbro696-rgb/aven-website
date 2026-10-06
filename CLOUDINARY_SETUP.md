# Cloudinary connection in admin Settings

Open `/admin`, sign in with an active Firebase admin account, and select Settings.

## One-time server configuration

1. In the Cloudinary card, select **Generate encryption key**, then **Copy key**. The generated value is a cryptographically random 32-byte key encoded as 64 hexadecimal characters. It remains in component memory only. Alternatively generate it locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
2. In Vercel → aven-website → Settings → Environment Variables, add `CLOUDINARY_INTEGRATION_KEY` with that value for the environments that run the admin panel (Preview for professional-redesign, and Production if used). Keep the value private. Never add a `NEXT_PUBLIC_` prefix or commit it.
3. Redeploy the corresponding branch/deployment, then select **Refresh status** in the card. Environment changes require a new deployment. Keep a secure backup of the key. Changing or losing it requires verifying and connecting Cloudinary again.

No Firebase service-account private key is needed. The API validates the Firebase ID token through Firebase Auth's accounts lookup endpoint and checks the active admin document through authenticated Firestore REST requests. Firestore rules must grant active, recently authenticated admins access to `settings` as in this repository's `firestore.rules`; deploying the website does not publish Firebase rules.

## Use the connection

- Enter Cloud name, API Key and API Secret from Cloudinary's API Keys page. Cloud name defaults to `pcprovqw` and can be changed.
- Select **Verify**. The server calls Cloudinary's authenticated `/ping` endpoint. Verification alone does not save or activate the connection.
- Within five minutes, select **Connect**. The server checks the connection again, then stores encrypted credentials in `settings/cloudinary`. Replacing an existing connection requires a new Verify/Connect cycle. Existing credentials remain active until a successful replacement or Disconnect.
- **Disconnect** deletes the stored connection even if the encryption key is unavailable. Existing images in Cloudinary are not deleted.
- While Settings is visible, status is checked every minute and when the window regains focus. The server caches Cloudinary health checks for up to 60 seconds per instance. A failed health check is shown in red with **Reconnect**. Reconnect performs a fresh check using the saved credentials. If credentials were revoked, enter new credentials and Verify/Connect again.

This settings feature manages the account connection. Product forms still use image URLs; direct product file upload is a separate implementation step. Cloudinary environment variables such as `CLOUDINARY_API_SECRET` are not used by this integration.

## Security and operational limits

- All API operations, including status, require a validated, unexpired Firebase ID token, an active admin document, and an authentication age under eight hours. Browser requests must come from the same origin. Bodies are limited to 4 KB.
- Credentials use AES-256-GCM authenticated encryption with separate purposes for saved connections and verification receipts. Receipts are bound to the admin UID and expire after five minutes. A receipt cannot be used as saved connection ciphertext.
- API responses return only masked account details, health status and an encrypted verification receipt. API Secret is never returned in plaintext or included in errors/logs. The UI clears the secret after successful verification and keeps receipts only in memory.
- Admin responses are marked private/no-store; requests have network deadlines. No unsigned upload preset is created. No credentials are sent to the storefront.
- The per-admin request limiter and health cache are in-memory and per server instance; they are not a distributed abuse-prevention system. Cloudinary API quotas may also apply. A successful ping verifies API access, not file upload permissions or storage capacity.
- Keep Firebase/Vercel/Cloudinary owner accounts and the encryption key protected. This feature does not prevent a compromised authorized administrator from replacing the account connection.

## Validation

`npm run build` includes mocked API tests covering unauthorized/disabled/revoked/stale sessions, cross-origin requests, body limits, real verification sequencing, encrypted persistence, verification expiry/tampering/UID binding, health errors/reconnect, disconnect with a missing key, and secret redaction. Tests make no real Cloudinary or Firebase writes.
