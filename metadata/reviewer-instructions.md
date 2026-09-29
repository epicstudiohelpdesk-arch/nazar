# App Store & Google Play Reviewer Access Instructions

## Purpose

This document provides Apple and Google App Review teams with deterministic access credentials, testing instructions, and validation notes for the Nazar mobile applications.

---

## 1. Test Account Credentials

The Nazar production platform maintains designated sandbox review accounts that do not require live SMS delivery or telecom provider verification.

- **Test Phone Number**: `+14155550199`
- **Fixed Reviewer OTP Code**: `777888` (Configured bypass code active for this designated review number)
- **Account Status**: Pre-populated Active Profile (`Alex`, Age 26, Verified Photos, Completed Bio & Prompts, Located in San Francisco, CA / London, UK sandbox radius).
- **Secondary Test Account (for Chat / Matching Testing)**:
  - Phone: `+14155550198`
  - Fixed OTP Code: `777888`

---

## 2. Reviewer Step-by-Step Walkthrough

### Step 1: Authentication & Onboarding

1. Launch the Nazar application.
2. Select **"Continue with Phone Number"**.
3. Enter `+14155550199`. Tap **"Send Code"**.
4. When prompted for verification, enter the fixed code `777888`.
5. You will immediately enter the application with the pre-configured profile.

### Step 2: Testing Spatial Discovery & Interactions

1. Navigate to the **Discovery** tab.
2. The card deck shows nearby candidate profiles.
3. Swipe right or tap the **Heart (Like)** button to express interest.
4. Swipe left or tap the **X (Pass)** button to dismiss a profile.
5. If liking the designated test match profile, an instant **Match Celebration Modal** will appear.

### Step 3: Real-Time Chat

1. Tap the **Conversations** tab to view your active matches.
2. Tap into an existing conversation.
3. Send a message: real-time delivery and read receipt status indicators will update dynamically.

### Step 4: Subscriptions & In-App Purchases (Sandbox)

1. Tap the **Billing & Premium** button on the home screen or settings.
2. The subscription tier screen displays `Nazar Plus` and `Nazar Premium`.
3. In StoreKit / Google Play Sandbox mode, test purchases will succeed without real financial charges.
4. Tap **"Restore Purchases"** to verify that entitlement states synchronize server-authoritatively.

### Step 5: Safety, Blocking & Reporting

1. From any match or chat screen, tap the safety shield (🛡️) icon.
2. Select **"Report User"** or **"Block User"**.
3. Select a reason (e.g. "Inappropriate Content").
4. The reported user is immediately hidden and excluded from discovery and messaging.

### Step 6: In-App Account Deletion (Apple Guideline 5.1.1(v) & Google Policy)

1. Navigate to **Account & Privacy** (Settings).
2. Tap **"Delete Account"** at the bottom of the screen.
3. Confirm the permanent deletion alert.
4. The account enters the deleted state, all active sessions are terminated, and you are returned to the welcome screen.

---

## 3. Important Reviewer Notes

- **Location Permissions**: Nazar prompts for "While Using the App" location permission to calculate nearby candidates. If denied, the app degrades gracefully, allowing users to enter a manual city.
- **Administrative Endpoints**: Nazar administrative systems (`/v1/admin`) are restricted to internal staff networks with strict IP whitelisting and hardware WebAuthn MFA. No admin credentials are exposed or required for consumer app store review.
- **Contact Support**: If you encounter any unexpected issues during review, please contact our dedicated release engineering team at `app-review@nazar.app` (monitored 24/7 during submission).
