# WhatsApp message templates

Every notification House of Collabs sends — to creators and to brands — written as WhatsApp message templates, ready to submit for approval with whichever WhatsApp provider you choose (Meta's WhatsApp Manager, AiSensy, Interakt, Gupshup, Twilio and others all take this same format).

- **46 templates**, all in **English**, category **Utility** (transactional updates, not promotions).
- Every template has a **sample value for each variable** — providers ask for these when you submit.
- Every template uses the footer **"House of Collabs"**.
- Buttons are **"Visit website"** buttons. Where the link ends in `{{1}}`, that part changes per message (an order ID, brief ID or storefront address); the sample shows a full example.
- The same list as a spreadsheet: [`whatsapp-templates.csv`](whatsapp-templates.csv).

## Before you submit

1. **Create each template with exactly the name shown** (lowercase, underscores). The sending code will look templates up by these names.
2. **Language:** English. **Category:** Utility. If a provider moves one to *Marketing*, it can still be sent, it just costs more per message.
3. **Paste the body exactly**, including the line breaks, emojis and `*bold*` markers. Then add the footer and the button.
4. **Fill in the samples** from the table under each template.
5. Approval usually takes from a few minutes to 24 hours. If one is rejected, send me the reason and I'll reword it.

**How variables are filled when sending:** `{{1}}` is always the recipient's first name. Amounts are sent formatted (₹4,500). Where a note or reason can be empty, the fallback in brackets is sent instead, because WhatsApp doesn't allow empty variables.

**Not covered on purpose:** chat and dispute *messages* stay in the app (they'd be too frequent for WhatsApp), and one-off **announcements** need their own *Marketing* template for each campaign, since WhatsApp doesn't allow a template that is just a variable.

**Marked "new"** in the tables: events the platform doesn't notify about today (application received / rejected), because applicants don't have an account yet. They make sense on WhatsApp because the sign-up forms collect a WhatsApp number.

## At a glance

| # | Template name | To | Sent when | Platform event |
|---|---|---|---|---|
| 1 | `creator_application_received` | Creator | They submit the creator sign-up form | `new` |
| 2 | `creator_application_approved` | Creator | An admin approves their application | `application_approved` |
| 3 | `creator_application_rejected` | Creator | An admin rejects their application | `new` |
| 4 | `profile_submitted` | Creator | They submit their profile for review | `profile_submitted` |
| 5 | `profile_approved` | Creator | Their profile goes live | `profile_approved` |
| 6 | `profile_needs_changes` | Creator | An admin sends their profile back for changes | `profile_rejected` |
| 7 | `profile_suspended` | Creator | An admin suspends their storefront | `profile_suspended` |
| 8 | `verification_submitted` | Creator | They submit verification details | `verification_submitted` |
| 9 | `creator_verified` | Creator | An admin verifies them | `creator_verified` |
| 10 | `verification_not_approved` | Creator | An admin rejects their verification | `verification_rejected` |
| 11 | `verification_more_info` | Creator | An admin asks for more verification details | `verification_more_info` |
| 12 | `order_new_creator` | Creator | A brand pays for one of their services | `order_new` |
| 13 | `brief_received_creator` | Creator | A brand sends them a campaign brief | `brief_received` |
| 14 | `order_cancelled_creator` | Creator | The brand or an admin cancels their order | `order_cancelled` |
| 15 | `product_shipped_creator` | Creator | The brand ships the product for an order | `shipment_update` |
| 16 | `revision_requested_creator` | Creator | The brand asks for changes to a delivery | `revision_requested` |
| 17 | `delivery_approved_creator` | Creator | The brand approves their delivery | `order_approved` |
| 18 | `order_completed_creator` | Creator | Their order is completed | `order_completed` |
| 19 | `review_received_creator` | Creator | A brand reviews their work | `review_received` |
| 20 | `dispute_opened_creator` | Creator | The brand opens a dispute on their order | `dispute_opened` |
| 21 | `dispute_resolved_creator` | Creator | An admin resolves a dispute on their order | `dispute_resolved` |
| 22 | `earnings_available` | Creator | Earnings become available to withdraw | `earnings_available` |
| 23 | `payout_requested` | Creator | They request a withdrawal | `payout_requested` |
| 24 | `payout_sent` | Creator | An admin sends their withdrawal | `payout_processed` |
| 25 | `payout_failed` | Creator | A withdrawal is rejected or fails | `payout_failed` |
| 26 | `brand_application_received` | Brand | They submit the brand sign-up form | `new` |
| 27 | `brand_account_ready` | Brand | Their brand account is created or approved | `application_approved / welcome` |
| 28 | `brand_application_rejected` | Brand | An admin rejects their application | `new` |
| 29 | `payment_received_brand` | Brand | Their payment for an order succeeds | `payment_received` |
| 30 | `payment_failed_brand` | Brand | Their payment for an order fails | `payment_failed` |
| 31 | `order_expired_brand` | Brand | An unpaid order expires | `order_expired` |
| 32 | `order_accepted_brand` | Brand | The creator accepts their order | `order_accepted` |
| 33 | `order_declined_brand` | Brand | The creator declines their order | `order_cancelled` |
| 34 | `order_cancelled_brand` | Brand | Their order is cancelled (by them or an admin) | `order_cancelled` |
| 35 | `shipment_required_brand` | Brand | The creator is waiting for the product | `shipment_required` |
| 36 | `product_received_brand` | Brand | The creator confirms the product arrived | `shipment_update` |
| 37 | `work_started_brand` | Brand | The creator starts work | `order_in_progress` |
| 38 | `content_delivered_brand` | Brand | The creator delivers the content | `content_delivered` |
| 39 | `revision_submitted_brand` | Brand | The creator delivers a revision | `revision_submitted` |
| 40 | `order_completed_brand` | Brand | Their order is completed | `order_completed` |
| 41 | `refund_processed_brand` | Brand | A refund for their order is processed | `refund_processed` |
| 42 | `review_received_brand` | Brand | A creator reviews their brand | `review_received` |
| 43 | `dispute_opened_brand` | Brand | The creator opens a dispute on their order | `dispute_opened` |
| 44 | `dispute_resolved_brand` | Brand | An admin resolves a dispute on their order | `dispute_resolved` |
| 45 | `account_suspended` | Creator or brand | An admin suspends their account | `account_suspended` |
| 46 | `account_reactivated` | Creator or brand | An admin reactivates their account | `account_reactivated` |

## Creators — joining and profile

### `creator_application_received`

**To:** Creator · **Sent when:** They submit the creator sign-up form · **Category:** Utility · **Language:** English

```
Hi {{1}}, thanks for applying to House of Collabs! 🎉

We've received your creator profile and our team is reviewing it now. We'll message you here as soon as there's an update.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |

**Footer:** House of Collabs  
**Button:** none

### `creator_application_approved`

**To:** Creator · **Sent when:** An admin approves their application · **Category:** Utility · **Language:** English

```
Hi {{1}}, welcome to House of Collabs! 🎉

Your creator profile has been approved. Log in to finish setting up your storefront so brands can discover and book you.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |

**Footer:** House of Collabs  
**Button:** Visit website — "Log in" → `https://www.houseofcollabs.com/login`

### `creator_application_rejected`

**To:** Creator · **Sent when:** An admin rejects their application · **Category:** Utility · **Language:** English

```
Hi {{1}}, thank you for applying to House of Collabs.

We're not able to approve your creator profile right now. Note from our team: {{2}}

You're welcome to apply again in the future.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Admin's note (or "No reason was given.") | Please add at least 3 recent videos. |

**Footer:** House of Collabs  
**Button:** none

### `profile_submitted`

**To:** Creator · **Sent when:** They submit their profile for review · **Category:** Utility · **Language:** English

```
Hi {{1}}, your House of Collabs profile has been submitted for review. ✅

We'll let you know here as soon as it's live.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |

**Footer:** House of Collabs  
**Button:** Visit website — "View profile" → `https://www.houseofcollabs.com/creator/profile`

### `profile_approved`

**To:** Creator · **Sent when:** Their profile goes live · **Category:** Utility · **Language:** English

```
Hi {{1}}, your creator profile is now live on House of Collabs! 🎉

Brands can now discover your storefront and book your services.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |

**Footer:** House of Collabs  
**Button:** Visit website — "View storefront" → `https://www.houseofcollabs.com/creators/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/creators/riya-sharma`

### `profile_needs_changes`

**To:** Creator · **Sent when:** An admin sends their profile back for changes · **Category:** Utility · **Language:** English

```
Hi {{1}}, your profile needs a few changes before it can go live.

Note from our team: {{2}}

Please update your profile and submit it again.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Admin's note | Please add a clearer profile photo. |

**Footer:** House of Collabs  
**Button:** Visit website — "Update profile" → `https://www.houseofcollabs.com/creator/profile`

### `profile_suspended`

**To:** Creator · **Sent when:** An admin suspends their storefront · **Category:** Utility · **Language:** English

```
Hi {{1}}, your creator profile has been suspended and is hidden from brands for now.

Reason: {{2}}

Please contact our support team if you have any questions.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Reason given by the admin | Repeated late deliveries. |

**Footer:** House of Collabs  
**Button:** Visit website — "Contact support" → `https://www.houseofcollabs.com/contact`

### `verification_submitted`

**To:** Creator · **Sent when:** They submit verification details · **Category:** Utility · **Language:** English

```
Hi {{1}}, we've received your verification details.

We're checking them now and will let you know shortly.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |

**Footer:** House of Collabs  
**Button:** none

### `creator_verified`

**To:** Creator · **Sent when:** An admin verifies them · **Category:** Utility · **Language:** English

```
Hi {{1}}, you're verified! ✅

Your verified badge is now showing on your House of Collabs storefront.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |

**Footer:** House of Collabs  
**Button:** Visit website — "View storefront" → `https://www.houseofcollabs.com/creators/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/creators/riya-sharma`

### `verification_not_approved`

**To:** Creator · **Sent when:** An admin rejects their verification · **Category:** Utility · **Language:** English

```
Hi {{1}}, your verification wasn't approved this time.

Note from our team: {{2}}

You can fix this and try again from your profile.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Admin's note | The name on the document does not match your profile. |

**Footer:** House of Collabs  
**Button:** Visit website — "Try again" → `https://www.houseofcollabs.com/creator/profile`

### `verification_more_info`

**To:** Creator · **Sent when:** An admin asks for more verification details · **Category:** Utility · **Language:** English

```
Hi {{1}}, we need a little more information to verify your account.

Note from our team: {{2}}

Please add the details from your profile.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Admin's note | Please upload the back of your ID card as well. |

**Footer:** House of Collabs  
**Button:** Visit website — "Add details" → `https://www.houseofcollabs.com/creator/profile`

## Creators — orders and briefs

### `order_new_creator`

**To:** Creator · **Sent when:** A brand pays for one of their services · **Category:** Utility · **Language:** English

```
Hi {{1}}, you have a new order! 🎉

*{{2}}* has ordered *{{3}}*. You'll earn *{{4}}* for this order.

Please accept it soon so the brand can get started.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Brand name | Glow Skincare |
| `{{3}}` | Service title | Instagram Reel |
| `{{4}}` | Creator's earning, formatted | ₹4,500 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/creator/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/creator/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `brief_received_creator`

**To:** Creator · **Sent when:** A brand sends them a campaign brief · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* has sent you a new campaign brief: *{{3}}*.

Take a look and reply from your dashboard.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Brand name | Glow Skincare |
| `{{3}}` | Brief title | Diwali skincare launch |

**Footer:** House of Collabs  
**Button:** Visit website — "View brief" → `https://www.houseofcollabs.com/creator/briefs/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/creator/briefs/3f2b8d1e-5a6c-4e7f-9b0a-1c2d3e4f5a6b`

### `order_cancelled_creator`

**To:** Creator · **Sent when:** The brand or an admin cancels their order · **Category:** Utility · **Language:** English

```
Hi {{1}}, order *{{2}}* has been cancelled.

Reason: {{3}}

No further action is needed from you.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Order number | HOC-10482 |
| `{{3}}` | Reason (or "No reason was given.") | The brand changed its campaign dates. |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/creator/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/creator/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `product_shipped_creator`

**To:** Creator · **Sent when:** The brand ships the product for an order · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* has shipped the product for order *{{3}}*. 📦

Please confirm on the order page once it arrives.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Brand name | Glow Skincare |
| `{{3}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/creator/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/creator/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `revision_requested_creator`

**To:** Creator · **Sent when:** The brand asks for changes to a delivery · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* has requested a revision on order *{{3}}*.

Open the order to see the changes they'd like.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Brand name | Glow Skincare |
| `{{3}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "View request" → `https://www.houseofcollabs.com/creator/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/creator/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `delivery_approved_creator`

**To:** Creator · **Sent when:** The brand approves their delivery · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* approved your delivery for order *{{3}}*. ✅

Great work! We'll let you know as soon as the order is complete and your earnings are added.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Brand name | Glow Skincare |
| `{{3}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/creator/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/creator/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `order_completed_creator`

**To:** Creator · **Sent when:** Their order is completed · **Category:** Utility · **Language:** English

```
Hi {{1}}, order *{{2}}* is now complete. 🎉

*{{3}}* has been added to your House of Collabs earnings. You can withdraw it once it becomes available.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Order number | HOC-10482 |
| `{{3}}` | Creator's earning, formatted | ₹4,500 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/creator/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/creator/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `review_received_creator`

**To:** Creator · **Sent when:** A brand reviews their work · **Category:** Utility · **Language:** English

```
Hi {{1}}, you received a new *{{2}}-star* review on order *{{3}}*. ⭐

Open the order to read it.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Star rating (1–5) | 5 |
| `{{3}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/creator/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/creator/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `dispute_opened_creator`

**To:** Creator · **Sent when:** The brand opens a dispute on their order · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* has opened a dispute on order *{{3}}*.

Our team will review it and contact you. You can add details on the order page.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Brand name | Glow Skincare |
| `{{3}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/creator/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/creator/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `dispute_resolved_creator`

**To:** Creator · **Sent when:** An admin resolves a dispute on their order · **Category:** Utility · **Language:** English

```
Hi {{1}}, the dispute on order *{{2}}* has been resolved.

Note from our team: {{3}}

Open the order for full details.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Order number | HOC-10482 |
| `{{3}}` | Admin's resolution note | The delivery was accepted and payment released. |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/creator/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/creator/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

## Creators — earnings and withdrawals

### `earnings_available`

**To:** Creator · **Sent when:** Earnings become available to withdraw · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* from your House of Collabs orders is now available to withdraw. 💰

You can request a withdrawal from your dashboard.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Amount, formatted | ₹12,000 |

**Footer:** House of Collabs  
**Button:** Visit website — "View earnings" → `https://www.houseofcollabs.com/creator/payouts`

### `payout_requested`

**To:** Creator · **Sent when:** They request a withdrawal · **Category:** Utility · **Language:** English

```
Hi {{1}}, we've received your withdrawal request for *{{2}}*.

We'll message you as soon as it's been sent.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Amount, formatted | ₹12,000 |

**Footer:** House of Collabs  
**Button:** Visit website — "Track withdrawal" → `https://www.houseofcollabs.com/creator/payouts`

### `payout_sent`

**To:** Creator · **Sent when:** An admin sends their withdrawal · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* has been sent to your bank account. 💸

Reference: {{3}}

It can take a little time to show up, depending on your bank.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Amount, formatted | ₹12,000 |
| `{{3}}` | Bank / UTR reference | UTR412345678901 |

**Footer:** House of Collabs  
**Button:** Visit website — "View withdrawals" → `https://www.houseofcollabs.com/creator/payouts`

### `payout_failed`

**To:** Creator · **Sent when:** A withdrawal is rejected or fails · **Category:** Utility · **Language:** English

```
Hi {{1}}, your withdrawal of *{{2}}* couldn't be completed.

Reason: {{3}}

Please check your payout details and try again.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Amount, formatted | ₹12,000 |
| `{{3}}` | Reason (or "Please check your payout details.") | The bank account number is invalid. |

**Footer:** House of Collabs  
**Button:** Visit website — "Update details" → `https://www.houseofcollabs.com/creator/payouts`

## Brands — joining

### `brand_application_received`

**To:** Brand · **Sent when:** They submit the brand sign-up form · **Category:** Utility · **Language:** English

```
Hi {{1}}, thanks for signing up *{{2}}* on House of Collabs! 🎉

Our team is reviewing your brand details. We'll message you here as soon as your account is ready.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Brand name | Glow Skincare |

**Footer:** House of Collabs  
**Button:** none

### `brand_account_ready`

**To:** Brand · **Sent when:** Their brand account is created or approved · **Category:** Utility · **Language:** English

```
Hi {{1}}, your brand account for *{{2}}* is ready! 🎉

Log in to discover creators and place your first order.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Brand name | Glow Skincare |

**Footer:** House of Collabs  
**Button:** Visit website — "Log in" → `https://www.houseofcollabs.com/login`

### `brand_application_rejected`

**To:** Brand · **Sent when:** An admin rejects their application · **Category:** Utility · **Language:** English

```
Hi {{1}}, thank you for your interest in House of Collabs.

We're not able to approve the account for *{{2}}* right now. Note from our team: {{3}}

Please contact our support team if you have any questions.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Brand name | Glow Skincare |
| `{{3}}` | Admin's note (or "No reason was given.") | We could not verify the brand website. |

**Footer:** House of Collabs  
**Button:** Visit website — "Contact support" → `https://www.houseofcollabs.com/contact`

## Brands — payments and orders

### `payment_received_brand`

**To:** Brand · **Sent when:** Their payment for an order succeeds · **Category:** Utility · **Language:** English

```
Hi {{1}}, we've received your payment of *{{2}}* for order *{{3}}*. ✅

*{{4}}* has been notified about your order, and we'll message you here as soon as they accept it.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Amount paid, formatted | ₹5,310 |
| `{{3}}` | Order number | HOC-10482 |
| `{{4}}` | Creator's name | Riya Sharma |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `payment_failed_brand`

**To:** Brand · **Sent when:** Their payment for an order fails · **Category:** Utility · **Language:** English

```
Hi {{1}}, your payment for order *{{2}}* didn't go through.

You can retry the payment from the order page.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "Retry payment" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `order_expired_brand`

**To:** Brand · **Sent when:** An unpaid order expires · **Category:** Utility · **Language:** English

```
Hi {{1}}, order *{{2}}* has expired because the payment wasn't completed.

You can place a new order any time from the creator's storefront.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `order_accepted_brand`

**To:** Brand · **Sent when:** The creator accepts their order · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* has accepted your order *{{3}}*. 🎉

We'll keep you updated as the work progresses.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Creator's name | Riya Sharma |
| `{{3}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `order_declined_brand`

**To:** Brand · **Sent when:** The creator declines their order · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* has declined your order *{{3}}*.

Reason: {{4}}

If you've paid, your refund is being processed automatically.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Creator's name | Riya Sharma |
| `{{3}}` | Order number | HOC-10482 |
| `{{4}}` | Reason (or "No reason was given.") | Not available on the requested dates. |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `order_cancelled_brand`

**To:** Brand · **Sent when:** Their order is cancelled (by them or an admin) · **Category:** Utility · **Language:** English

```
Hi {{1}}, order *{{2}}* has been cancelled.

Reason: {{3}}

If you've paid, your refund is being processed automatically.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Order number | HOC-10482 |
| `{{3}}` | Reason (or "No reason was given.") | Cancelled at your request. |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `shipment_required_brand`

**To:** Brand · **Sent when:** The creator is waiting for the product · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* is ready to start order *{{3}}* and is waiting for your product. 📦

Their shipping address is on the order page. Please ship the product and add the tracking details there.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Creator's name | Riya Sharma |
| `{{3}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "Add tracking" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `product_received_brand`

**To:** Brand · **Sent when:** The creator confirms the product arrived · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* has received your product for order *{{3}}*. ✅

They'll start creating your content next.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Creator's name | Riya Sharma |
| `{{3}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `work_started_brand`

**To:** Brand · **Sent when:** The creator starts work · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* has started working on your order *{{3}}*. 🎬

We'll let you know as soon as the content is delivered.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Creator's name | Riya Sharma |
| `{{3}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `content_delivered_brand`

**To:** Brand · **Sent when:** The creator delivers the content · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* has delivered your content for order *{{3}}*. 🎉

Please review it and approve, or request a revision.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Creator's name | Riya Sharma |
| `{{3}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "Review delivery" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `revision_submitted_brand`

**To:** Brand · **Sent when:** The creator delivers a revision · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* has submitted a revision for order *{{3}}*.

Please review the updated content and approve it, or request further changes.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Creator's name | Riya Sharma |
| `{{3}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "Review delivery" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `order_completed_brand`

**To:** Brand · **Sent when:** Their order is completed · **Category:** Utility · **Language:** English

```
Hi {{1}}, your order *{{2}}* with *{{3}}* is complete. ✅

Leave a review to help other brands find great creators.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Order number | HOC-10482 |
| `{{3}}` | Creator's name | Riya Sharma |

**Footer:** House of Collabs  
**Button:** Visit website — "Leave a review" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `refund_processed_brand`

**To:** Brand · **Sent when:** A refund for their order is processed · **Category:** Utility · **Language:** English

```
Hi {{1}}, your refund for order *{{2}}* has been processed.

It usually takes 5–7 working days to reach your account, depending on your bank.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `review_received_brand`

**To:** Brand · **Sent when:** A creator reviews their brand · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* rated your brand *{{3}} stars* for order *{{4}}*. ⭐

Open the order to read their feedback. Reviews help creators decide which brands to work with.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Creator's name | Riya Sharma |
| `{{3}}` | Star rating (1–5) | 5 |
| `{{4}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `dispute_opened_brand`

**To:** Brand · **Sent when:** The creator opens a dispute on their order · **Category:** Utility · **Language:** English

```
Hi {{1}}, *{{2}}* has opened a dispute on order *{{3}}*.

Our team will review it and contact you. You can add details on the order page.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Creator's name | Riya Sharma |
| `{{3}}` | Order number | HOC-10482 |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

### `dispute_resolved_brand`

**To:** Brand · **Sent when:** An admin resolves a dispute on their order · **Category:** Utility · **Language:** English

```
Hi {{1}}, the dispute on order *{{2}}* has been resolved.

Note from our team: {{3}}

Open the order for full details.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Order number | HOC-10482 |
| `{{3}}` | Admin's resolution note | A partial refund of ₹2,000 was issued. |

**Footer:** House of Collabs  
**Button:** Visit website — "View order" → `https://www.houseofcollabs.com/brand/orders/{{1}}`  
**Button sample:** `https://www.houseofcollabs.com/brand/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7`

## Creators and brands — account

### `account_suspended`

**To:** Creator or brand · **Sent when:** An admin suspends their account · **Category:** Utility · **Language:** English

```
Hi {{1}}, your House of Collabs account has been suspended.

Reason: {{2}}

Please contact our support team if you have any questions.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |
| `{{2}}` | Reason (or "Contact support for details.") | Contact support for details. |

**Footer:** House of Collabs  
**Button:** Visit website — "Contact support" → `https://www.houseofcollabs.com/contact`

### `account_reactivated`

**To:** Creator or brand · **Sent when:** An admin reactivates their account · **Category:** Utility · **Language:** English

```
Hi {{1}}, good news — your House of Collabs account is active again. ✅

You can log in and pick up where you left off.
```

| Variable | What goes in it | Sample |
|---|---|---|
| `{{1}}` | Recipient's first name | Riya |

**Footer:** House of Collabs  
**Button:** Visit website — "Log in" → `https://www.houseofcollabs.com/login`
