# Nazar Mobile · Social, Communities & Events Experience QA Matrix

Production QA protocol for the Nazar mobile Social, Communities & Events experience (F7): Explore, global and community feeds, post detail and comments, community detail and membership, member moderation, event discovery, RSVP and waitlisting, event location privacy, safety controls, and cache consistency.

**Preconditions**

- A seeded local API (`pnpm dev:api`) with `pnpm db:migrate` applied, and a build pointed at it.
- Test accounts: **Owner** (created a community), **Admin**, **Member**, **Interested** (has an `INTERESTED` RSVP), **Waitlisted**, **Outsider** (not a member), plus one blocked user.
- One public event with capacity headroom, one full event with the waitlist enabled, one full event with the waitlist disabled, one online event, and one private-venue physical event with coordinates set.
- Run on a physical iOS device and an Android device. Airplane mode is required for the offline scenarios.

---

## 1. Explore (`SocialHomeScreen`)

| #   | Step                                                               | Expected Behavior                                                                                                                     | Result |
| :-- | :----------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :----- |
| 1.1 | Open the Explore tab on a cold cache.                              | Each section shows its own skeleton. Sections do not wait for one another; a fast list renders while a slower one is still loading.   | PASS   |
| 1.2 | Open Explore with all four data sources healthy.                   | Upcoming events, my communities, communities to explore, and latest posts each render up to 5 cards with working "See all" links.     | PASS   |
| 1.3 | Open Explore as a brand-new user with no communities.              | "You have not joined any communities yet" with a **Find communities** action. Posts show "No posts yet" with **Write the first one**. | PASS   |
| 1.4 | Force the events request to fail, leaving the other three healthy. | Only the events section shows the mapped error and a **Try again** button. The other three sections stay interactive.                 | PASS   |
| 1.5 | Confirm the events request fails.                                  | The message is a deliberate, human sentence — not a raw server string, not "Bad Request", and **not** "No events".                    | PASS   |
| 1.6 | Tap **Try again** on the failed section.                           | Only that section refetches; the other sections do not flash or reset.                                                                | PASS   |
| 1.7 | Verify `social_home_opened` fires.                                 | Event is emitted with no PII properties.                                                                                              | PASS   |

---

## 2. Global Feed & Pagination

| #   | Step                                                   | Expected Behavior                                                                                                                                  | Result |
| :-- | :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 2.1 | Open `/social/feed`.                                   | Posts render newest first with author, content, media, relative time, like and comment counts.                                                     | PASS   |
| 2.2 | Scroll to the end of a full page.                      | Exactly one `GET /v1/social/feed` call per page with the returned cursor. No duplicate requests per scroll frame.                                  | PASS   |
| 2.3 | Reach the end of the last page.                        | "You are all caught up" is shown and no further request is issued.                                                                                 | PASS   |
| 2.4 | Post new content from another account while paged in.  | Continue paging. The server enforces order; the client does not re-sort and no row is duplicated.                                                  | PASS   |
| 2.5 | Pull to refresh.                                       | RefreshControl animates in Saffron and the first page is refetched.                                                                                | PASS   |
| 2.6 | Open the feed with zero posts.                         | Empty state with **Create the first post**.                                                                                                        | PASS   |
| 2.7 | Tap the heart on a feed card.                          | The post detail opens. **No** reaction is written: `getFeed` returns `userReaction: null`, so a feed must never show a reaction it cannot justify. | PASS   |
| 2.8 | Verify no filled heart is rendered anywhere in a feed. | Every heart is unfilled, because the feed DTO has no viewer reaction.                                                                              | PASS   |

---

## 3. Stale Content

| #   | Step                                                         | Expected Behavior                                                                                                                                                      | Result |
| :-- | :----------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 3.1 | Load a feed, then enable airplane mode and pull to refresh.  | Cached posts stay on screen with a **Could not refresh. Showing the last saved posts.** banner and a **Try again** button. Content is not silently presented as fresh. | PASS   |
| 3.2 | With airplane mode still on, reload the screen from scratch. | The full error state renders instead of a stale banner plus an empty list. The two states are never shown together.                                                    | PASS   |
| 3.3 | Repeat 3.1 on the member roster and the attendee roster.     | Both keep the cached rows and explain that the list may be out of date.                                                                                                | PASS   |

---

## 4. Post Detail, Comments & Reactions

| #    | Step                                                            | Expected Behavior                                                                                                         | Result |
| :--- | :-------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ | :----- |
| 4.1  | Open your own post.                                             | **Edit** and **Delete** are visible.                                                                                      | PASS   |
| 4.2  | Open someone else's post.                                       | Neither **Edit** nor **Delete** is visible; **Block author** is available.                                                | PASS   |
| 4.3  | Sign out of the profile store and open a post.                  | No owner controls are shown. An unidentified viewer is never shown control of content.                                    | PASS   |
| 4.4  | Open a post with comments.                                      | Comments render under it.                                                                                                 | PASS   |
| 4.5  | Force the comments request to fail on a post that has comments. | A comment-specific error with retry renders — **not** "No comments yet", which would deny that comments exist.            | PASS   |
| 4.6  | Add a comment as the post author.                               | **Delete** appears on your own comment.                                                                                   | PASS   |
| 4.7  | Add a comment as another user.                                  | **Delete** appears for the comment author and for the post author, and for nobody else.                                   | PASS   |
| 4.8  | Delete your own comment.                                        | It disappears and `post` caches are refetched.                                                                            | PASS   |
| 4.9  | Try each of the five reaction types on post detail.             | All five write; the tapped one fills and the others clear. `LIKE` emits `post_liked`, the other four emit `post_reacted`. | PASS   |
| 4.10 | Remove a reaction.                                              | The post returns to its previous state and emits `post_unliked`.                                                          | PASS   |
| 4.11 | Force a reaction request to fail.                               | The button returns to the server state; the UI never shows a reaction that was not saved.                                 | PASS   |
| 4.12 | Edit your own post.                                             | Changes persist and the feed refreshes.                                                                                   | PASS   |
| 4.13 | Delete your own post.                                           | A destructive confirmation appears; after confirming, the post is gone from detail and from every feed.                   | PASS   |

---

## 5. Post Composer

| #   | Step                                      | Expected Behavior                                                                                              | Result |
| :-- | :---------------------------------------- | :------------------------------------------------------------------------------------------------------------- | :----- |
| 5.1 | Open `/social/create-post` from the feed. | Header reads **Text only**. No photo picker is offered, because no upload endpoint exists.                     | PASS   |
| 5.2 | Open the composer with `?communityId=`.   | Reads **Posting to &lt;community&gt;** and **Community post**.                                                 | PASS   |
| 5.3 | Check the visibility options.             | Public, Community only, and Followers only are all offered. The API accepts all three, so no option is locked. | PASS   |
| 5.4 | Post successfully from a community.       | The post appears in the global feed and in that community's feed without a manual refresh.                     | PASS   |
| 5.5 | Tap **Cancel**.                           | The composer closes and nothing is created.                                                                    | PASS   |

---

## 6. Community Creation & Editing

| #    | Step                                                                     | Expected Behavior                                                                                                                                   | Result |
| :--- | :----------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 6.1  | Open `/social/communities/create`.                                       | Name, description, joining rules, and three privacy options with hints.                                                                             | PASS   |
| 6.2  | Enter a 1-character name.                                                | An inline "Use at least 2 characters" error appears and **Create** stays disabled.                                                                  | PASS   |
| 6.3  | Create your first community.                                             | You become its OWNER, it appears under **My communities**, and `community_created` + `community_joined (via: created)` fire.                        | PASS   |
| 6.4  | Create up to three communities.                                          | All three succeed.                                                                                                                                  | PASS   |
| 6.5  | Attempt a fourth community on a free account.                            | The API answers `ENTITLEMENT_REQUIRED`; the form explains the limit and offers **See plans** to `/billing`. It does not guess your remaining quota. | PASS   |
| 6.6  | As OWNER, open the community About tab.                                  | **Edit community** is visible.                                                                                                                      | PASS   |
| 6.7  | As a plain Member or MODERATOR, check the About tab.                     | **Edit community** is absent, matching the API's OWNER/ADMIN rule.                                                                                  | PASS   |
| 6.8  | Edit the name, description, privacy, and rules.                          | Changes save, and **no** premium upsell appears — a creation limit does not apply to an edit.                                                       | PASS   |
| 6.9  | Remove every rule and save.                                              | Rules are cleared on the server and the About tab shows "This community has not published any rules."                                               | PASS   |
| 6.10 | Set privacy to **Approval required** and then join from another account. | The other account's action becomes "Request to join sent. A moderator will review it", not "You have joined".                                       | PASS   |

---

## 7. Community Membership & Members

| #    | Step                                                  | Expected Behavior                                                                                      | Result |
| :--- | :---------------------------------------------------- | :----------------------------------------------------------------------------------------------------- | :----- |
| 7.1  | Join a public community as an outsider.               | Immediate `ACTIVE` join; the feed and events become visible.                                           | PASS   |
| 7.2  | Join an approval-required community.                  | Status is `PENDING`; the button reads **Request pending**, is disabled, and a moderator note is shown. | PASS   |
| 7.3  | As a PENDING member, view the About tab.              | The state is explained rather than looking like a network failure.                                     | PASS   |
| 7.4  | Leave the community.                                  | The button returns to **Join community**; community-only content disappears.                           | PASS   |
| 7.5  | Open the members roster.                              | Paginated list with role badges, newest-joined first per the server, and no duplicates across pages.   | PASS   |
| 7.6  | As a plain Member, look for **Remove**.               | It is absent.                                                                                          | PASS   |
| 7.7  | As OWNER or ADMIN, find **Remove** on another member. | It is present for everyone except yourself and the owner.                                              | PASS   |
| 7.8  | Attempt to remove the owner or yourself.              | No control is offered.                                                                                 | PASS   |
| 7.9  | Remove a member.                                      | A confirmation appears; on success the row disappears and `community_member_banned` fires.             | PASS   |
| 7.10 | Force the ban request to fail.                        | An inline message appears, `community_member_ban_failed` fires, and the member stays listed.           | PASS   |
| 7.11 | Block a user, then view the roster.                   | The blocked user is absent, as the API filters them out.                                               | PASS   |
| 7.12 | Sign in as a user with a `BANNED` membership.         | The state is **Access restricted** with an explanation; no join control is offered.                    | PASS   |

---

## 8. Events, RSVP & Waitlisting

| #    | Step                                                                  | Expected Behavior                                                                                                                                                                         | Result |
| :--- | :-------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 8.1  | Open `/social/events`.                                                | Upcoming events with date, coarse location, and attendee count. Filters by community and type.                                                                                            | PASS   |
| 8.2  | Host an event from **Host an event**.                                 | Online or physical, dates, `HH:MM` times, location details, optional capacity, optional waitlist.                                                                                         | PASS   |
| 8.3  | End the event before it starts.                                       | An inline error explains the problem and **Try again** resubmits. **See plans** does not appear, because hosting has no premium gate.                                                     | PASS   |
| 8.4  | RSVP **Go** to an event with space.                                   | **You're going** with your place confirmed.                                                                                                                                               | PASS   |
| 8.5  | Switch to **Interested** after confirming.                            | Releases the confirmed place and reads **You're interested**. The hint explains that a waiting person is promoted automatically.                                                          | PASS   |
| 8.6  | RSVP to a full event with the waitlist enabled.                       | The server answers `WAITLISTED`; the UI shows **On the waitlist** and offers **Go** and **Leave waitlist** — but **not** **Interested**, which would silently drop the waitlist position. | PASS   |
| 8.7  | RSVP to a full event with the waitlist disabled.                      | The server answers `EVENT_FULL`; the UI explains the event is full and does not suggest a client-side workaround or a retry loop.                                                         | PASS   |
| 8.8  | As a waitlisted attendee, have the organiser cancel a confirmed RSVP. | You are promoted to **You're going** automatically, FIFO.                                                                                                                                 | PASS   |
| 8.9  | Leave the waitlist.                                                   | The position is released and the count updates.                                                                                                                                           | PASS   |
| 8.10 | Open a cancelled or completed event.                                  | RSVPs are closed with a stated reason; the status you held is still shown.                                                                                                                | PASS   |
| 8.11 | Check the RSVP controls on a full event as a non-responder.           | **Go** is still offered. The client does not pre-compute capacity; the server decides.                                                                                                    | PASS   |
| 8.12 | Switch the event list filter between community and type.              | Each combination caches separately and each renders correctly.                                                                                                                            | PASS   |
| 8.13 | RSVP, then leave the event and come back.                             | The attendee count and your status are correct without a manual full reload.                                                                                                              | PASS   |

---

## 9. Event Location Privacy

| #   | Step                                         | Expected Behavior                                                                                                                                                                                                          | Result |
| :-- | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 9.1 | Open a physical event as an outsider.        | The coarse `locationName` shows. The address, URL, **latitude and longitude** are all withheld, and the screen says the exact address is shared with confirmed attendees. It is not presented as an event without a venue. | PASS   |
| 9.2 | Inspect the raw response with an API client. | `locationAddress`, `locationUrl`, `latitude` and `longitude` are all `null` for a non-attendee — on **both** the detail and the list endpoint.                                                                             | PASS   |
| 9.3 | RSVP `INTERESTED` and re-open the event.     | The address stays withheld. Interested is not a confirmed place.                                                                                                                                                           | PASS   |
| 9.4 | Confirm `GOING` and re-open the event.       | The address, URL, and coordinates appear.                                                                                                                                                                                  | PASS   |
| 9.5 | Open the event as the organiser.             | The full location is always visible, and the hosting controls are visible.                                                                                                                                                 | PASS   |
| 9.6 | Open an online event as an outsider.         | The withheld detail is the **joining link**, and the notice says so.                                                                                                                                                       | PASS   |
| 9.7 | Tap a venue link.                            | It opens in the system browser; if the device cannot open it, a failure is surfaced rather than a silent no-op.                                                                                                            | PASS   |

---

## 10. Hosting an Event

| #    | Step                                                       | Expected Behavior                                                                                         | Result |
| :--- | :--------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- | :----- |
| 10.1 | As the organiser, open the event and scroll to the bottom. | A **Hosting this event** section with **Cancel event**.                                                   | PASS   |
| 10.2 | As a non-organiser, check the same screen.                 | The hosting section is absent.                                                                            | PASS   |
| 10.3 | Tap **Cancel event**.                                      | A destructive confirmation explains that attendees will see the cancellation.                             | PASS   |
| 10.4 | Confirm.                                                   | The event becomes cancelled, RSVPs close, `event_cancelled` fires, and it is removed from upcoming lists. | PASS   |
| 10.5 | Force the cancel request to fail.                          | An inline error appears and the event is not shown as cancelled.                                          | PASS   |

---

## 11. Safety Controls

| #    | Step                                      | Expected Behavior                                                                                                        | Result |
| :--- | :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :----- |
| 11.1 | Report a post.                            | `ReportModal` opens with canonical reasons; submission confirms without echoing PII and emits `social_report_submitted`. | PASS   |
| 11.2 | Report a community, an event, and a user. | All four target types work from the same component.                                                                      | PASS   |
| 11.3 | Block a post author.                      | `BlockModal` confirms, `social_block_submitted` fires, and the author is excluded from social content.                   | PASS   |
| 11.4 | Hit the report rate limit.                | The server's limit is explained; the UI does not loop requests.                                                          | PASS   |

---

## 12. Cache Consistency

| #    | Step                                                                                           | Expected Behavior                                                                                            | Result |
| :--- | :--------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :----- |
| 12.1 | Create a post inside a community from its detail screen.                                       | The global feed, the community feed, and the standalone community feed all show it without a manual refresh. | PASS   |
| 12.2 | Create an event from a community and open the Events screen with a different community filter. | The new event appears under the matching filter; no stale empty list remains.                                | PASS   |
| 12.3 | RSVP from event detail, then open the attendee preview and the full roster.                    | The attendee chip and roster both reflect the change.                                                        | PASS   |
| 12.4 | Edit a community, then open Communities and Explore.                                           | The new name appears in "my communities", in discovery, and in the Explore preview.                          | PASS   |
| 12.5 | Confirm the attendee preview and the full roster do not share one cache slot.                  | Both render correctly at the same time; the short preview is not polluted by paginated rows or vice versa.   | PASS   |

---

## 13. Accessibility & Offline

| #    | Step                                                              | Expected Behavior                                                                                                                             | Result |
| :--- | :---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 13.1 | VoiceOver through every social screen.                            | Every control has a label and, where the outcome is non-obvious, a hint. Decorative text is hidden so nothing is announced twice.             | PASS   |
| 13.2 | Check role labels and privacy options.                            | Announced as radio buttons with a selected state.                                                                                             | PASS   |
| 13.3 | Check the stale banner and error rows.                            | Announced as alerts with a polite live region.                                                                                                | PASS   |
| 13.4 | Increase the text size to maximum.                                | No clipped labels, no overlapping controls, and the RSVP buttons remain fully reachable.                                                      | PASS   |
| 13.5 | Enable airplane mode and open every screen.                       | Each failure is a deliberate, actionable message. No screen shows an empty state for a failed request, and no raw server string is displayed. | PASS   |
| 13.6 | Rotate the device on the composers.                               | Fields keep their values and the keyboard never covers the submit control.                                                                    | PASS   |
| 13.7 | Verify dynamic type, contrast, and hit targets on both platforms. | Meet the F0 design system minimums.                                                                                                           | PASS   |

---

## 14. Regression Sweep

| #    | Step                                                                  | Expected Behavior                                                                                                        | Result |
| :--- | :-------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :----- |
| 14.1 | Run `npx tsc --noEmit -p apps/mobile/tsconfig.json`.                  | Clean.                                                                                                                   | PASS   |
| 14.2 | Run `npx tsc --noEmit -p apps/api/tsconfig.json`.                     | Clean.                                                                                                                   | PASS   |
| 14.3 | Run `npx vitest run tests/social.test.ts tests/social-state.test.ts`. | All passing.                                                                                                             | PASS   |
| 14.4 | Run `npx eslint src/social app/social --ext .ts,.tsx`.                | No errors, no warnings.                                                                                                  | PASS   |
| 14.5 | Open Matches, Chat, and Profile.                                      | F4–F6 surfaces are unaffected by the social changes.                                                                     | PASS   |
| 14.6 | Rebuild the API contracts package.                                    | `UpdateCommunityRequestDto.rules` accepts `null` to clear rules, matching the validation schema and the `PATCH` service. | PASS   |
