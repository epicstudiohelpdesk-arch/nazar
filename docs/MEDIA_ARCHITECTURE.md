# Media Architecture & Upload Lifecycle Specification

## Overview

The Media domain handles photo uploads, storage, ordering, and delivery for dating profiles. Direct binary uploads never transit through the application server; instead, clients upload directly to S3/MinIO/Cloudflare R2 via presigned URLs.

---

## 1. Presigned Upload Protocol

```text
Mobile Client                   Backend API                      Object Storage (S3 / R2)
     │                               │                                     │
     │ 1. POST /media/upload-url     │                                     │
     │    { mimeType, sizeBytes }    │                                     │
     │ ────────────────────────────> │                                     │
     │                               │ 2. Validate format/size/quota       │
     │                               │ 3. Insert PENDING row               │
     │                               │ 4. Generate S3 presigned PUT URL    │
     │ <──────────────────────────── │                                     │
     │    { mediaId, uploadUrl, ... }│                                     │
     │                               │                                     │
     │ 5. HTTP PUT binary payload                                          │
     │ ──────────────────────────────────────────────────────────────────> │
     │ <────────────────────────────────────────────────────────────────── │
     │    200 OK                                                           │
     │                               │                                     │
     │ 6. POST /media/:id/complete   │                                     │
     │ ────────────────────────────> │                                     │
     │                               │ 7. Mark status = READY              │
     │                               │ 8. Auto-elect primary if first      │
     │                               │ 9. Recalculate completeness         │
     │                               │ 10. Emit outbox event               │
     │ <──────────────────────────── │                                     │
     │    { id, url, isPrimary, ... }│                                     │
```

---

## 2. Media Lifecycle States

- **PENDING**: Presigned URL generated; upload not yet initiated.
- **UPLOADING**: Client is actively uploading binary to object storage.
- **PROCESSING**: Image uploaded; queued for moderation/virus scan/resizing.
- **READY**: Image verified and visible on profile.
- **REJECTED**: Image failed moderation or safety scan.
- **DELETED**: Soft-deleted; scheduled for asynchronous storage purge.

---

## 3. Storage Constraints & Quotas

- **Maximum Photos**: 6 photos per profile. Attempting to request a 7th upload returns `400 MEDIA_LIMIT_REACHED`.
- **Supported Formats**: `image/jpeg`, `image/png`, `image/webp`, `image/heic`. Unsupported formats return `400 VALIDATION_ERROR`.
- **Maximum File Size**: 15 MB (`15,728,640` bytes). Larger payloads return `400 VALIDATION_ERROR`.
- **Presigned URL Expiry**: 15 minutes (900 seconds).

---

## 4. Primary Photo Invariants

1. **Auto-Election**: The first photo completed on a profile is automatically designated as `isPrimary = true`.
2. **Exclusivity**: Only one photo can be primary at any time (`isPrimary = true`). Setting another photo as primary automatically clears `isPrimary` on the prior primary photo.
3. **Re-Election on Deletion**: When the primary photo is deleted, the next available `READY` photo is automatically elected as the new primary photo.
4. **Active Profile Protection**: A profile in the `ACTIVE` state is strictly forbidden from deleting its only remaining photo (`400 PRIMARY_MEDIA_REQUIRED`). The user must pause or hide their profile first, or upload an alternative photo.

---

## 5. Security & Isolation

- **Owner-Only Mutations**: Only the authenticated owner can complete, set primary, reorder, or delete their profile media. Any attempt by another user is rejected with `403 FORBIDDEN` or `404 MEDIA_NOT_FOUND`.
- **Key Obfuscation**: Storage object keys (e.g. `profiles/018f.../photo.jpg`) are never included in public profile DTOs; only sanitized public CDN URLs are returned.
