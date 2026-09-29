# STORE REVIEW & REJECTION HANDLING RUNBOOK · GATE 20

**Product**: Nazar Mobile Application  
**Platforms**: Apple App Store (iOS) & Google Play Store (Android)  
**Release Candidate Version**: `1.0.0` (Android `versionCode: 10000`, iOS `CFBundleVersion: 10000`)  
**Scope**: Operational guide for Engineering, Release, and Product teams during App Review and store compliance audits.

---

## 1. Guiding Principles During Store Review

1. **Strict Policy Compliance**: Never bypass store policies or introduce runtime cloaking / hidden feature toggles.
2. **Reviewer Respect & Transparency**: Reviewers must see actual product functionality via authorized review credentials.
3. **Immutability of Release Candidate**: Never patch binary code directly in App Store Connect or Google Play Console. If a code fix is necessary, a new Release Candidate commit must be created, verified, and tagged.

---

## 2. Reviewer Account & Access Information

The following credentials and configurations are pre-provisioned for store review teams:

- **Reviewer Phone**: `+1-555-019-2026`
- **Fixed OTP Verification Code**: `123456` (Configured in sandbox bypass table; does not expire)
- **Reviewer User ID**: Pre-seeded active profile (`Amina K.`, Age 26, San Francisco, CA)
- **Pre-seeded Matches & Conversations**:
  - Match 1: `Tariq M.` (Active conversation with 3 mock messages)
  - Match 2: `Zayn S.` (Unread greeting message)
- **Passkey / Biometric Bypass**: Reviewers may skip biometric/passkey enrollment using the "Use Phone Verification Instead" fallback button.

If reviewer credentials report an error:

- Verify that `SMS_PROVIDER_MOCK_BYPASS=true` is enabled in the production reviewer sandbox route.
- Check database `users` record where `phone_number = '+15550192026'`. Ensure `status = 'ACTIVE'`.

---

## 3. Handling Review Rejections by Category

### A. Apple Guideline 1.2 — User-Generated Content (UGC)

_Common Trigger_: App involves profiles, messaging, or social feeds where users can upload content.
_Mandatory Requirements Verified in Nazar_:

1. **EULA & Terms**: App requires agreement to Terms of Service (`/v1/compliance/terms`) prohibiting harassment, hate speech, and nudity before profile creation.
2. **In-App Reporting**: Report button accessible on every profile (`POST /v1/reports`), every conversation, and every post.
3. **In-App Blocking**: Immediate user block (`POST /v1/users/:userId/block`) that mutually hides both users across feeds and chats.
4. **24-Hour Moderation**: Automated quarantine worker halts profiles with 3+ reports pending admin review.
   _Reviewer Response Template_:

> "Dear Review Team, Nazar enforces strict UGC safety measures in compliance with Guideline 1.2:
>
> 1. All users must agree to our Terms of Service (prohibiting inappropriate or abusive content) prior to profile setup.
> 2. Users can block objectionable users instantly by tapping '...' -> 'Block User' on any profile or chat screen, which immediately purges mutual visibility.
> 3. Users can flag violations via 'Report User', which places the reported content in our 24/7 automated moderation queue.
> 4. We act on reports and moderate offensive material within 24 hours. Contact information is clearly provided in our Safety Guidelines."

---

### B. Apple Guideline 5.1.1(v) & Google Play — Account Deletion

_Common Trigger_: Reviewer cannot locate the account deletion button or web request link.
_Implementation in Nazar_:

- **In-App**: Located at `Settings` -> `Account Settings` (`apps/mobile/app/settings/account.tsx`). Tapping "Delete Account" prompts a confirmation dialog and triggers `DELETE /v1/auth/account`.
- **Web Link**: Publicly accessible without login at `https://nazar.app/legal/delete-account` (served by `GET /v1/compliance/delete-account`).
  _Reviewer Response Template_:

> "Dear Review Team, Account deletion is fully implemented both in-app and on the web:
>
> 1. In-app: Navigate to Settings -> Account Settings -> Delete Account. Once confirmed, the account, profile, sessions, and push tokens are immediately purged.
> 2. Web: Users can also request deletion at https://nazar.app/legal/delete-account without installing the app. All user data is processed according to our GDPR/CCPA compliant privacy policy."

---

### C. Apple Guideline 3.1.1 — In-App Purchases & Payments

_Common Trigger_: Reviewer claims digital features can be unlocked outside Apple IAP.
_Policy Alignment in Nazar_:

- All premium features (Nazar Gold, Nazar Platinum, Boosts) are strictly purchased via Apple In-App Purchases (`StoreKit`) on iOS and Google Play Billing on Android.
- No external web checkout, Stripe checkout, or alternative payment links are exposed in mobile builds.
  _Reviewer Response Template_:

> "Dear Review Team, All digital subscriptions and consumables in Nazar utilize Apple In-App Purchases via StoreKit. We do not provide external purchasing links, web redirection, or alternate payment methods in our iOS release."

---

### D. Apple Guideline 5.1.2 — Privacy Manifests & Tracking

_Common Trigger_: Missing `PrivacyInfo.xcprivacy` or undeclared API usage (e.g. `UserDefaults`, `FileTimestamp`).
_Implementation in Nazar_:

- `apps/mobile/ios/PrivacyInfo.xcprivacy` declares:
  - `NSPrivacyTracking`: `false` (Zero cross-app or third-party ad tracking).
  - `NSPrivacyCollectedDataTypes`: User ID, Photos, Location (Coarse), Usage Data.
  - `NSPrivacyAccessedAPITypes`: `NSPrivacyAccessedAPICategoryUserDefaults` (Reason `CA92.1`), `NSPrivacyAccessedAPICategoryFileTimestamp` (Reason `C617.1`), `NSPrivacyAccessedAPICategorySystemBootTime` (Reason `35F9.1`).
    _Action if Rejected_:
- Verify that Xcode 15+ bundled the `.xcprivacy` file into the main bundle root.
- Re-run `pnpm --filter @platform/mobile build` and inspect the generated IPA payload.

---

### E. Age Rating & Questionnaire (17+ / Mature)

_Policy Alignment_:

- Nazar is strictly restricted to adults aged 18 and older.
- Google Play Content Rating: **Mature 17+** (Dating app, user interactions).
- Apple App Store Age Rating: **17+** (Unrestricted Web Access / Frequent/Intense Mature-Suggestive Themes).
  _Reviewer Response_:

> "Nazar is an adult dating platform strictly for individuals aged 18 and older. Our age-gating requires DOB verification at onboarding, and our store age rating is formally set to 17+ / Mature."

---

### F. Technical Rejection / App Crashes on Reviewer Devices

_Common Causes_:

1. Reviewer testing on iPad (Compatibility mode crash).
2. Network timeout to API backend from Apple Cupertino IP address ranges.
3. Reviewer entering non-standard characters in phone input.
   _Remediation Process_:
4. **Retrieve Crash Logs**: Download `.crash` or `.ips` file from App Store Connect Resolution Center.
5. **Symbolicate**:
   ```bash
   atos -arch arm64 -o apps/mobile/dist/nazar.app.dSYM/Contents/Resources/DWARF/nazar -l <load_address> <crash_address>
   ```
6. **Inspect Sentry**: Check Sentry filter for `user.id: "reviewer"` or IP origin `17.0.0.0/8` (Apple internal network).
7. **Firewall / Geo-blocking Check**: Confirm that Cloudflare does not block Apple's California IP ranges (`17.*.*.*`) on `/v1/*` or `/.well-known/*`.

---

## 4. Emergency Reviewer Credential Recovery

If the reviewer sends a message stating: _"We were unable to sign in with the provided credentials"_:

1. Inspect the production auth logs for attempts from `+15550192026`:
   ```bash
   kubectl logs -l app=nazar-api -n production --tail=500 | grep "15550192026"
   ```
2. Reset reviewer OTP challenge in database:
   ```sql
   DELETE FROM otp_challenges WHERE phone_number = '+15550192026';
   UPDATE users SET status = 'ACTIVE' WHERE phone_number = '+15550192026';
   ```
3. Test the bypass code `123456` against `POST /v1/auth/otp/verify` with curl.
4. Reply promptly in Resolution Center within 2 hours:
   > "Dear Review Team, We have refreshed the reviewer session and verified that logging in with +1-555-019-2026 and code 123456 is fully operational. Please attempt login again. Thank you!"

---

## 5. Escalation Contacts

- **Release Engineering**: `release-eng@nazar.internal`
- **Store Operations Lead**: `appstore-ops@nazar.internal`
- **Security & Privacy Officer**: `privacy@nazar.internal`
