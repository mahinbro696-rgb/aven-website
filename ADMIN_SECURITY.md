# AVEN admin security

## Website protections

Admin access requires a current Firebase token and a fresh server read of `admins/{uid}` with `active: true`. Missing, false, numeric or string flags do not authorize access. Authorization verification times out after 15 seconds and fails closed. A real-time listener locks the UI when the owner's authorization is removed, disabled, or the listener fails. Authentication events use generation checks so late verification cannot restore a signed-out session.

Admin authentication uses tab session persistence. The UI signs out after 10 minutes without interaction, after 8 hours from credential authentication, and on an offline event. These browser-side locks reduce unattended access; Firebase Rules remain the enforcement boundary for direct database requests. Sign-out does not revoke a previously stolen token on another device.

The admin route has framing protection, a scoped Content Security Policy, and no-index headers/metadata. CSP allows Next.js inline bootstrap scripts and inline styling; it is defense in depth, not a complete XSS guarantee. Firebase passwords are not stored in this repository.

## Required Firebase deployment

**Vercel does not deploy `firestore.rules` or `storage.rules`.** The website code can be live while the Firebase rules changes remain pending.

In Firebase Console, select project `aven-ba684`, open Firestore Database → Rules, replace the editor contents with this repository's `firestore.rules`, and click Publish. Alternatively, on a trusted computer after Firebase CLI login:

```sh
npx firebase-tools deploy --only firestore:rules --project aven-ba684
```

The new Firestore rules retain public product/category reads and the existing anonymous checkout flow. Private orders/settings and catalog writes require an active admin authenticated within eight hours. All browser writes to `admins` are denied, including writes by an existing admin. Grant or revoke access only through Firebase Console or a trusted Admin SDK; keep the owner's document `active: true`.

If Firebase Storage is enabled, deploy its matching rules separately:

```sh
npx firebase-tools deploy --only storage --project aven-ba684
```

Without authenticated Firebase project access, an agent cannot confirm these rule deployments or modify Authentication provider settings.

## Account protections to configure in Firebase/Google

Use a unique strong admin password and protect the Google account owning Firebase with two-step verification. Restrict project IAM access and review enabled sign-in providers and authorized domains. Enable Firebase email enumeration protection and password policy in Authentication settings. Multi-factor authentication and App Check require provider/project configuration and client enrollment; they are not enabled by this code change.

If an account or token is compromised, disable its `admins/{uid}` document in Firebase Console, then disable the Auth user/revoke refresh tokens using trusted administrative tooling. A valid stolen token can remain usable until expiry unless the rules deny it; disabling the admin record removes the database authorization.

## Verification

`npm test` checks strict admin flags, eight-hour expiry boundaries, and verification deadlines alongside existing commerce regressions. Browser QA separately covers anonymous/inactive/expired sessions, denied verification, revoked permission, idle logout, offline locking, and late authorization races using mocked Firebase calls; these tests do not prove the currently deployed Firebase rules.

The updated Firestore rules were also compiled and exercised in a demo-project Firestore emulator: anonymous/ordinary/inactive/expired users cannot read orders or write catalog/admin grants; an active fresh owner can manage catalog/orders but cannot create admin grants; public catalog reads and the existing anonymous checkout still succeed. This emulator result is not a production deployment confirmation.
