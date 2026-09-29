# Nazar Store Release Compliance Checklist

This checklist defines the technical verification and compliance criteria for releasing the Nazar Release Candidate to Google Play and Apple App Store.

---

## 1. Android Release Checklist (Google Play)

- [x] **Release Signing**: Production keystore configured with PKCS12 format; enrolled in Google Play App Signing. Private keystore and credentials isolated outside Git.
- [x] **Target SDK**: Configured for Android 15 (Target SDK 35, Compile SDK 35, Min SDK 24).
- [x] **Package Identifier**: Immutable canonical package ID `com.nazar.app`.
- [x] **Monotonic Versioning**: `versionName: "1.0.0"`, `versionCode: 10000`.
- [x] **Permissions Audit**: Declared only `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `CAMERA`, `READ_MEDIA_IMAGES`, and `POST_NOTIFICATIONS`. No background location or address book permissions.
- [x] **Digital Asset Links (App Links)**: `/.well-known/assetlinks.json` verified with SHA-256 certificate fingerprints for `nazar.app` and `links.nazar.app` with `autoVerify: true`.
- [x] **Cleartext Traffic Disabled**: `cleartextTrafficPermitted: false` enforced in production network security configuration.
- [x] **Play Console Metadata**: Short description (80 chars), full description (4000 chars), app icon (512x512 PNG), feature graphic (1024x500 PNG), phone screenshots (1080x1920).
- [x] **Google Play Data Safety**: Complete data inventory disclosed for location, user account identifiers, photos, product interaction, and crash logs.
- [x] **Content Rating (IARC)**: Rated Mature 17+ (dating functionality, user-generated text/photos, interactive social messaging).
- [x] **Public Privacy Policy**: Publicly hosted at `https://nazar.app/legal/privacy` and `https://api.nazar.app/v1/compliance/privacy`.
- [x] **In-App & Web Account Deletion**: Supported both natively via `Profile -> Settings -> Account -> Delete Account` and on the web at `https://nazar.app/legal/delete-account`.
- [x] **Subscription & In-App Purchases**: In-app purchase products declared and server-authoritatively verified in sandbox/production (`nazar.plus.monthly`, `nazar.premium.monthly`).
- [x] **Google Play Reviewer Access**: Pre-configured test account instructions and reviewer credentials supplied in Play Console App Access section.

---

## 2. iOS Release Checklist (Apple App Store)

- [x] **Distribution Signing**: Configured with Apple Distribution Certificate & App Store Provisioning Profile. Credentials isolated via CI/CD secrets.
- [x] **Bundle Identifier**: Immutable canonical bundle ID `com.nazar.app`.
- [x] **Monotonic Build Numbers**: `CFBundleShortVersionString: "1.0.0"`, `CFBundleVersion: "10000"`.
- [x] **Entitlements**: Push Notifications (`aps-environment: production`), Associated Domains (`applinks:nazar.app`, `applinks:links.nazar.app`), Sign in with Apple (`Default`).
- [x] **Universal Links**: `/.well-known/apple-app-site-association` verified with Apple Team ID `TEAMID1234.com.nazar.app` over HTTPS.
- [x] **Privacy Manifest (`PrivacyInfo.xcprivacy`)**: Full Apple privacy manifest declaring `NSPrivacyTracking: false`, user identifiers, device identifiers, precise location, photos, crash logs, and UserDefaults API reasons (`CA92.1`).
- [x] **Usage Descriptions (Info.plist)**: Truthful, human-readable strings provided for `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, and `NSLocationWhenInUseUsageDescription`.
- [x] **Export Compliance**: `ITSAppUsesNonExemptEncryption: false` declared.
- [x] **App Store Metadata**: App Name ("Nazar: Spatial Social Discovery"), Subtitle (30 chars), Description (4000 chars), Keywords (100 chars), Support URL, Marketing URL.
- [x] **App Privacy Details**: Mapped accurately to App Store Connect privacy questionnaire.
- [x] **Age Rating**: 17+ (Infrequent/Mild Mature Themes, User-Generated Content, Unrestricted Web/Chat Interaction).
- [x] **Public Privacy Policy & Terms**: Publicly accessible via HTTPS.
- [x] **In-App Account Deletion (Guideline 5.1.1(v))**: Fully accessible inside the app with immediate session revocation and data deletion.
- [x] **StoreKit In-App Purchases (Guideline 3.1.1)**: Server-authoritative purchase and restore workflows implemented; non-authoritative client purchase states rejected.
- [x] **App Store Reviewer Notes**: Deterministic reviewer path with test phone number, bypass OTP credentials, and feature explanation provided.
