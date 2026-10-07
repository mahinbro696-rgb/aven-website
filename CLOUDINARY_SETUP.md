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

Settings manages the account connection. Add/Edit Product supports direct uploads for the main image and each color variant, while retaining the optional URL fields. Cloudinary environment variables such as `CLOUDINARY_API_SECRET` are not used by this integration.

## Security and operational limits

- All API operations, including status, require a validated, unexpired Firebase ID token, an active admin document, and an authentication age under eight hours. Browser requests must come from the same origin. Bodies are limited to 4 KB.
- Credentials use AES-256-GCM authenticated encryption with separate purposes for saved connections and verification receipts. Receipts are bound to the admin UID and expire after five minutes. A receipt cannot be used as saved connection ciphertext.
- API responses return only masked account details, health status and an encrypted verification receipt. API Secret is never returned in plaintext or included in errors/logs. The UI clears the secret after successful verification and keeps receipts only in memory.
- Admin responses are marked private/no-store; requests have network deadlines. No unsigned upload preset is created. No credentials are sent to the storefront.
- The per-admin request limiter and health cache are in-memory and per server instance; they are not a distributed abuse-prevention system. Cloudinary API quotas may also apply. A successful ping verifies API access, not file upload permissions or storage capacity.
- Keep Firebase/Vercel/Cloudinary owner accounts and the encryption key protected. This feature does not prevent a compromised authorized administrator from replacing the account connection.

## Validation

`npm run build` includes mocked API tests covering unauthorized/disabled/revoked/stale sessions, cross-origin requests, body limits, real verification sequencing, encrypted persistence, verification expiry/tampering/UID binding, health errors/reconnect, disconnect with a missing key, and secret redaction. Tests make no real Cloudinary or Firebase writes.

## Product image uploads

In Products → Add product or Edit products, use **Upload image** (or drag/drop) for the main image or any color. JPG, PNG and WebP files up to 15 MB are accepted in the browser. Decoded images are resized to at most 2000 pixels on the longest side and re-encoded before upload, removing embedded metadata. The prepared image must be at most 3 MB to stay below the Vercel request limit. GIF/SVG/HEIC are not accepted; export those as JPG, PNG or WebP first.

The authenticated `/api/admin/images` endpoint checks the active admin session, same-origin request, MIME type, file magic bytes and streaming body limit. It reads the encrypted connection fresh for each upload and uploads through Cloudinary's HTTPS image endpoint with server-side Basic authentication. Cloudinary decodes the image; only a validated HTTPS Cloudinary image URL and dimensions are returned. Credentials, unsigned presets and upload signatures are never exposed to the client.

Uploads receive unique public IDs under `aven/products/`, with overwrite disabled. Upload alone does not publish a product: use **Publish Product** or **Save changes** to attach the URL to Firestore. Saving and changing sections/products are blocked while uploads run. Cancel aborts the browser request and preserves the previous product URL; if Cloudinary already received the file, it may remain in the Media Library. Unused/replaced uploads are retained and can be removed manually there. A timeout is reported as uncertain, so check the Media Library before retrying.

Product edits keep storefront publication separate from stock availability: a published product with zero stock is still marked visible in the editor. Unsaved product changes prompt before changing sections or products. CSV exports escape spreadsheet formula inputs.
