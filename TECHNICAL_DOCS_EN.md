# Yatta-Yam-Yam – Technical Documentation

**Version:** 1.12.0  
**Date:** November 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Data Model](#4-data-model)
5. [Authentication & Session](#5-authentication--session)
6. [Route Reference](#6-route-reference)
7. [Order Lifecycle](#7-order-lifecycle)
8. [Payment Handling](#8-payment-handling)
9. [Configuration](#9-configuration)
10. [Local Setup](#10-local-setup)
11. [Project Structure](#11-project-structure)
12. [Colour Scheme (Dark Mode)](#12-colour-scheme-dark-mode)

---

## 1. Project Overview

Yatta-Yam-Yam is an internal web application for collective food ordering. Users select dishes from predefined menu lists, the order creator calls the restaurant to place the combined order, and then manages incoming payments.

**Core features:**
- Shared access password for the app, then name-based sign-in without a personal password (cookie)
- Order management with a status lifecycle
- Reusable menu lists with a visibility toggle (hidden lists are excluded from new orders)
- Click an item image in an order to view it large (modal with name and price; browse with arrows, arrow keys or swiping)
- Location filter (Kassel / Frankfurt)
- Per-person tip distribution
- "Cost split" order type: one person buys everything and the total is split equally among everyone who joins
- Tracking of who advanced/fronted the money (with a quick self-fill button)
- Payment tracking (Cash, PayPal, Wero)
- Contact book (name, location, address, phone numbers, image) with a quick lookup in the phone-order dialog
- User statistics (total spend, open amounts)
- Red badge with the open amount next to your own name in the navbar
- Dark mode that follows the operating system setting
- Seasonal looks with occasional visitors: Pizza (6–12 February), Easter (two weeks before Easter until Easter Monday), Garlic (19 April and 6 October), Halloween (18–31 October), Día de los Muertos (1–7 November), Christmas (Monday after Totensonntag until 26 December)
- Year-end review "Wrapped" with statistics per location and per person (`/wrapped`)

---

## 2. Tech Stack

| Layer          | Technology                           |
|----------------|--------------------------------------|
| Backend        | Spring Boot 3.2.3, Spring MVC        |
| Security       | Spring Security 6                    |
| ORM            | Hibernate / Spring Data JPA          |
| Database       | H2 (file-based, persistent)          |
| Templates      | Thymeleaf 3                          |
| Frontend       | Bootstrap 5.3                        |
| Build          | Maven 3 / Java 17                    |

---

## 3. Architecture

The application follows the classic MVC pattern with a single deployable artifact (Fat JAR).

```
Browser
  │
  ▼
Spring MVC Controller
  │         │
  │         ▼
  │     Thymeleaf Template → HTML Response
  │
  ▼
Service Layer (Business Logic)
  │
  ▼
Spring Data JPA Repository
  │
  ▼
H2 Database (file: ./data/yatta_yam_yam_db)
```

**Two sign-in steps, one after the other:**

| Step | Mechanism | Purpose |
|------|-----------|---------|
| 1. Access password (`/login`) | Spring Security form login with remember-me | Unlocks the app – one shared account `yatta` for all users |
| 2. Name (`nameapp_user`) | Custom implementation via `LoginController` | Determines who you are in the app (no personal password) |

---

## 4. Data Model

### Entities and Relationships

```
AppUser ─────────────────────────────────────────────────────┐
  │                                                           │
  │ 1:n (creator)          1:n (user)                        │
  ▼                        ▼                                  │
FoodOrder ──── 1:n ──► UserOrderSelection ──── 1:n ──► SelectionItem
  │                                                       │
  │ n:1                                               n:1 │
  ▼                                                       ▼
ItemList ──── 1:n ──────────────────────────────────► Item
```

### AppUser

| Field          | Type       | Description                                    |
|----------------|------------|------------------------------------------------|
| `id`           | Long (PK)  | Auto-generated primary key                     |
| `name`         | String     | Unique username (case-insensitive)             |
| `registeredAt` | LocalDate  | Set automatically via `@PrePersist`            |

### FoodOrder

| Field              | Type             | Description                                          |
|--------------------|------------------|------------------------------------------------------|
| `id`               | Long (PK)        |                                                      |
| `placeName`        | String           | Name of the restaurant                               |
| `orderDate`        | LocalDate        |                                                      |
| `creator`          | AppUser (FK)     | Creator / responsible person                         |
| `itemList`         | ItemList (FK)    | Linked menu list (optional)                          |
| `status`           | OrderStatus      | OPEN, ORDERED, CLOSED, ARCHIVED                      |
| `location`         | Location         | KASSEL or FRANKFURT (optional)                       |
| `tipAmount`        | BigDecimal       | Total tip amount (split evenly among participants)   |
| `paypalLink`       | String           | Creator's PayPal.me link                             |
| `weroLink`         | String           | Creator's Wero link                                  |
| `orderedByContact` | String           | Name of the person who called in the order           |
| `paidByName`       | String           | Name of the person who advanced/fronted the money (can be set when creating, closing and editing the order, pre-fillable with your own name via the "I'm paying" button) |
| `orderType`        | OrderType        | ITEMS (pick items from a menu list) or SPLIT (cost split); `null` on older rows = ITEMS |
| `splitTotal`       | BigDecimal       | SPLIT only: total amount split among all participants. Optional when creating, required to close |

**OrderStatus lifecycle:**

```
OPEN ──► ORDERED ──► CLOSED ──► ARCHIVED
  ▲           │
  └───────────┘  (Reopen possible from ORDERED or CLOSED)
```

### ItemList

| Field     | Type        | Description                     |
|-----------|-------------|---------------------------------|
| `id`      | Long (PK)   |                                 |
| `name`    | String      | Name of the menu list           |
| `creator` | AppUser     | Creator of the list             |
| `visible` | boolean     | Whether the list is offered when creating a new order (default `true`); hidden lists can be created by mistake and toggled off via the hidden item-list page |
| `items`   | List\<Item\>| Menu items contained in the list|

### Item

| Field      | Type       | Description                                     |
|------------|------------|-------------------------------------------------|
| `id`       | Long (PK)  |                                                 |
| `name`     | String     | Name of the dish                                |
| `price`    | BigDecimal | Price in euros                                  |
| `imageUrl` | String     | Image URL or path to an uploaded file           |
| `itemList` | ItemList   | Parent menu list                                |

### UserOrderSelection

Links a user to an order and holds their item choices as well as payment status.

| Field               | Type                 | Description                                         |
|---------------------|----------------------|-----------------------------------------------------|
| `id`                | Long (PK)            |                                                     |
| `order`             | FoodOrder            | Associated order                                    |
| `user`              | AppUser              | Participating user                                  |
| `items`             | List\<SelectionItem\>| Selected items                                      |
| `paid`              | boolean              | User has self-marked as paid                        |
| `markedPaidByOwner` | boolean              | Creator has confirmed the payment                   |
| `paymentMethod`     | PaymentMethod        | CASH, PAYPAL, or WERO                               |

`getSubtotal()` calculates the sum of all `(price × quantity)` for the selection's items.

### Contact

Contact book entry (e.g. a restaurant or delivery service). Independent of the other entities.

| Field          | Type          | Description                                         |
|----------------|---------------|-----------------------------------------------------|
| `id`           | Long (PK)     |                                                     |
| `name`         | String        | Contact name (required)                             |
| `location`     | Location      | KASSEL or FRANKFURT (required, same enum as `FoodOrder`) |
| `address`      | String        | Address (optional)                                  |
| `phoneNumbers` | List<String>  | Any number of phone numbers, order is preserved (table `contact_phone_number`) |
| `imageUrl`     | String        | Image URL or path to an uploaded image (optional)   |

### SelectionItem

| Field       | Type                 | Description                        |
|-------------|----------------------|------------------------------------|
| `id`        | Long (PK)            |                                    |
| `selection` | UserOrderSelection   | Parent selection                   |
| `item`      | Item                 | Selected dish                      |
| `quantity`  | int                  | Quantity ordered                   |

---

## 5. Authentication & Session

Access works in two steps: first a shared access password unlocks the app (Spring Security), then each user identifies themselves by name (custom cookie). The password protects the app from the outside; the name only determines who you are in the app and is not protected by a personal password.

### Step 1: Access Password (Spring Security)

Spring Security protects all routes. Only these are publicly accessible (without the password):
- `/css/**`, `/js/**`, `/images/**`, `/uploads/**`
- `/version`

Every other request – including the name entry on `/` and the H2 console – redirects visitors who have not entered the password to `/login`. There they enter the shared access password; the username `yatta` is a hidden field in the form. The account is configured in `application.properties`:
```
spring.security.user.name=yatta
spring.security.user.password=${YATTA_YAM_YAM_PASSWORD}
```

After a successful login, Spring Security redirects to the originally requested URL, otherwise to `/`.

Remember-Me is always on (hidden field `remember-me=true`) with a token validity of one year, so each browser only needs the password once a year. The UI has no logout button; "Switch Account" only clears the name cookie from step 2, not the password login.

CSRF protection is disabled for `POST /login` (`csrf.ignoringRequestMatchers("/login")`). The CSRF token lives in the server-side session; if that session had expired by the time the form was submitted (timeout, restart, restored tab), the login was rejected silently and the user ended up on `/login` again. With a single shared account, login CSRF gives an attacker nothing. All other forms remain CSRF-protected.

### Step 2: Name Login (Cookie)

After the password, each user identifies themselves by name. The identity is stored in an HttpOnly cookie `nameapp_user` containing the URL-encoded username. The controllers read this cookie themselves; if it is missing or the name is unknown, they redirect to `/` for name entry.

**Flow:**
1. `GET /` — Cookie present with a known name → logged in immediately
2. `POST /check-name` — Name found in DB → confirmation screen; new → create account
3. `POST /confirm-login` / `POST /confirm-new-login` — Set cookie, redirect

The cookie has an expiry of `Integer.MAX_VALUE` seconds (~68 years), is `HttpOnly`, and applies to path `/`.

**Redirect preservation:** When someone without a name cookie opens an order or contact page (`/orders/**`, `/contacts/**`) or the year-end review (`/wrapped`), the URL is stored in the session under `redirectAfterLogin` and restored after name entry. Together with the redirect from step 1, a shared link ends up on the right page after the password and name entry.

---

## 6. Route Reference

### Login Flow (`LoginController`)

| Method | Path                 | Description                                         |
|--------|----------------------|-----------------------------------------------------|
| GET    | `/`                  | Home: auto-login via cookie or show name input      |
| POST   | `/check-name`        | Check name: known → confirm, new → create account   |
| POST   | `/confirm-login`     | Log in existing user, set cookie                    |
| POST   | `/not-me`            | Return to name input                                |
| POST   | `/confirm-new-login` | Log in new user, set cookie                         |
| POST   | `/switch-account`    | Clear cookie, redirect to `/`                       |
| GET    | `/login`             | Enter the access password (Spring Security)         |
| POST   | `/rename`            | Rename user, update cookie                          |
| GET    | `/version`           | Version page (public)                               |
| GET    | `/users`             | User statistics (logged-in users only)              |
| GET    | `/themes`            | All looks with preview links (hidden page, not linked anywhere; logged-in users only) |

### Year-end review (`WrappedController`)

| Method | Path                 | Description                                         |
|--------|----------------------|-----------------------------------------------------|
| GET    | `/wrapped`           | Overview of all past years with orders              |
| GET    | `/wrapped?year=2025` | That year's "Wrapped" story                         |

### Orders (`OrderController`, prefix `/orders`)

| Method | Path                         | Description                                      |
|--------|------------------------------|--------------------------------------------------|
| GET    | `/orders/dashboard`          | Dashboard with open orders                       |
| GET    | `/orders/archive`            | Archive of closed orders                         |
| GET    | `/orders/payment-calculator/data` | JSON for the payment calculator: all payments + own open amounts |
| GET    | `/orders/create`             | Form: create new order                           |
| POST   | `/orders/create`             | Create order                                     |
| GET    | `/orders/{id}`               | View order detail                                |
| GET    | `/orders/{id}/edit`          | Form: edit order (creator only)                  |
| POST   | `/orders/{id}/edit`          | Update order                                     |
| GET    | `/orders/{id}/close`         | Form: close order                                |
| POST   | `/orders/{id}/close`         | Close order (status → CLOSED); `tipAmount` or `totalAmount` |
| POST   | `/orders/{id}/archive`       | Archive order (status → ARCHIVED)                |
| POST   | `/orders/{id}/reopen`        | Reopen order (status → OPEN)                     |
| POST   | `/orders/{id}/mark-ordered`  | Mark as called in (status → ORDERED)             |
| POST   | `/orders/{id}/select`        | Save user's item selection                       |
| POST   | `/orders/{id}/join`          | Cost split: join (status OPEN only)              |
| POST   | `/orders/{id}/leave`         | Cost split: leave again (status OPEN only)       |

### Items & Menu Lists

| Method | Path                                                    | Description                           |
|--------|---------------------------------------------------------|---------------------------------------|
| GET    | `/orders/itemlists`                                     | List all menu lists + toggle visibility (hidden page, not linked elsewhere) |
| POST   | `/orders/itemlists/{listId}/visibility`                 | Show/hide a menu list                 |
| GET    | `/orders/itemlist/{listId}/items`                       | Manage items in a list                |
| POST   | `/orders/itemlist/{listId}/items/add`                   | Add item                              |
| GET    | `/orders/itemlist/{listId}/items/{itemId}/edit`         | Edit item (form)                      |
| POST   | `/orders/itemlist/{listId}/items/{itemId}/edit`         | Update item                           |
| POST   | `/orders/itemlist/{listId}/items/{itemId}/delete`       | Delete item (only if not yet ordered) |
| POST   | `/orders/itemlist/{listId}/rename`                      | Rename menu list                      |

### Payment Status

| Method | Path                                      | Description                                       |
|--------|-------------------------------------------|---------------------------------------------------|
| POST   | `/orders/selection/{selId}/pay`           | User marks themselves as paid                     |
| POST   | `/orders/selection/{selId}/unpay`         | User reverts their own paid mark                  |
| POST   | `/orders/selection/{selId}/owner-paid`    | Creator confirms payment for a user               |
| POST   | `/orders/selection/{selId}/owner-unpaid`  | Creator reverts payment confirmation              |

### Contacts (`ContactController`, prefix `/contacts`)

| Method | Path                     | Description                                                |
|--------|--------------------------|------------------------------------------------------------|
| GET    | `/contacts`              | Contact list, optionally filtered (`?location=KASSEL`)     |
| GET    | `/contacts/new`          | Form: new contact                                          |
| POST   | `/contacts/new`          | Create contact                                             |
| GET    | `/contacts/{id}/edit`    | Form: edit contact                                         |
| POST   | `/contacts/{id}/edit`    | Update contact                                             |
| POST   | `/contacts/{id}/delete`  | Delete contact                                             |

The contact book is reachable via the "Contacts" button on the dashboard. In the phone-order dialog on the order detail page, the contact-book icon opens a read-only lookup pop-up (no edit) listing all contacts and their numbers; contacts at the order's location are listed first.

---

## 7. Order Lifecycle

### Status Transitions

```
OPEN
  │  Creator clicks "Mark as ordered"
  ▼
ORDERED  ←──── (Reopen resets status back to OPEN)
  │  Creator clicks "Close order"
  ▼
CLOSED
  │  Creator clicks "Archive"
  ▼
ARCHIVED
```

### Detailed Flow

1. **Create order** — Creator chooses restaurant, date, menu list, and optionally a location.
   - "Paid By" as well as the PayPal and Wero links can optionally be entered right away if already known.
   - The PayPal and Wero links are pre-filled from the creator's most recent order and can be changed or cleared.
   - Only **visible** menu lists are offered for selection.
   - When creating a brand-new list inline, a "Use this item list next time" checkbox (preselected, but uncheckable) controls whether the list stays visible for future orders.
2. **Participants select dishes** — Each user picks menu items with quantities. The selection is saved as a `UserOrderSelection` with `SelectionItem` entries.
3. **Mark as ordered** (ORDERED) — Creator records who called in the order. Users see a warning if they try to change their selection afterwards.
4. **Close order** (CLOSED) — Creator optionally enters the total tip **or** the total amount paid (the other field is calculated: tip = total paid − order sum) and can fill in or correct "Paid By" as well as the PayPal and Wero links. The tip is split evenly among all participants who have at least one item.
5. **Manage payments** — Users mark themselves as paid; the creator can confirm or revoke payments.
6. **Archive** (ARCHIVED) — Order disappears from the dashboard and moves to the archive.

### Tip Calculation

```java
tipPerPerson = tipAmount / numberOfParticipantsWithItems
// Rounding: HALF_UP to 2 decimal places

// Only the total entered (totalAmount, no tipAmount):
tipAmount = totalAmount - sumOfAllSelections   // only if >= 0
```

### "Cost split" Order Type (SPLIT)

One person buys everything; there is no menu list and there are no items. Users join via "I'm in" (a `UserOrderSelection` without `SelectionItem`s) and can leave again while the order is OPEN. Everyone who joined is a paying participant.

- **When creating**, the total amount (`splitTotal`) is optional. Tip, menu list, phone order and the ORDERED status do not apply.
- **While open**, participants only see the number of participants and join. Only the creator sees amounts: the total and the *current maximum* per person (it drops with every person who joins; also on their dashboard tile), and without a total a calculator: price per person × participants = total. The final amount and payment options appear for everyone only after closing.
- **When closing**, the creator enters either the total (`splitTotal`) or a price per person (`splitPerPerson`); the other field is calculated. If only `splitPerPerson` arrives, the server sets `splitTotal = splitPerPerson × participants`. The order is not closed without an amount.

```java
splitShare = splitTotal / numberOfParticipants
// Rounding: UP to 2 decimal places, so the person who paid never loses cents
```

---

## 8. Payment Handling

Supported payment methods (`PaymentMethod` enum):

| Method | Description                                   |
|--------|-----------------------------------------------|
| CASH   | Cash payment                                  |
| PAYPAL | Payment via the creator's PayPal.me link      |
| WERO   | Payment via the creator's Wero link           |

**Paid status:** A selection is considered paid when `paid == true` (self-marked) **or** `markedPaidByOwner == true` (confirmed by the creator).

**Dashboard display:**
- **For the creator:** Red alert showing number and total amount of outstanding payments
- **For other users:** Grey info box showing open amounts for the order
- **For everyone:** If a payer (`paidByName`) is set, the tile shows "Paid by <name>" below the creator

### Open amounts in the navbar

If a user still owes money, a red badge with the total open amount appears next to their name in the navbar (dashboard, order detail, archive, contacts). That way they are reminded even when a shared link takes them straight to a new order. Clicking the name or the badge leads to the personal overview (`/`), which lists every open order under "Still to pay" with amount and payee and links to the order.

Every participation (`isParticipant`, so cost splits too) counts if it
- belongs to an order with status **CLOSED** (archived orders don't count, since participants can no longer mark them as paid there),
- is neither marked as paid by the user nor confirmed by the creator, and
- doesn't belong to the payee themselves. The payee is the payer (`paidByName`, case-insensitive), or the creator if no payer is set.

Amount per order = own items + tip share or cost share (`OrderService.getOpenDebts`). The "Open payments" and "Amount due" tiles on the overview and the columns of the same name on `/users` use the same calculation. `OpenDebtInterceptor` puts `openDebts` and `openDebtTotal` into the model of every page that contains a `user`. The badge itself is the fragment `fragments/open-debt-badge.html`.

### Payment calculator (dashboard)

The "Calculator" button next to "New Order" opens a dialog that lists payments from orders and adds them up — for example when someone collects money via another person's PayPal and that person passes the amount on in cash. It also opens with the shortcut **Alt+C** (Mac: **⌥C**) on the dashboard and via the link `/orders/dashboard?calculator` (the parameter survives both login steps and is then removed from the address bar). A short note at the top of the dialog explains what it is for. The calculator changes no data and is available to every user.

- **Payments:** every participation (`isParticipant`) that is marked as paid by the participant or confirmed by the creator, in orders of any status. Archived orders are hidden by default (see the *Archive* filter). Amount = own items + tip share or cost share (`getPerPersonCharge`). Grouped by order (newest first) with place, date, creator and — if different — payer; each row shows participant, payment type and amount.
- **Not paid yet** (optional, see the *Unpaid* filter): participations in orders with status CLOSED that are neither marked as paid nor confirmed by the creator — the same rules as `getOpenDebts`, so without the payee themselves. The viewer's own open amounts are left out here; they are listed under *Own debts* and would otherwise count twice. They show up as rows marked "Not paid yet" and count towards the total like payments.
- **Filters** (multiple choice; nothing selected = no restriction; different filters apply together):
  - *Paid by:* who receives the money (`OrderService.getPayee`: `paidByName`, otherwise the creator; case-insensitive)
  - *Payment type:* PayPal, Wero, Cash (plus "Not specified" for old rows without a payment type)
  - *PayPal link / Wero link:* the orders' links. With at least one link selected, only payments made through a selected link count — PayPal payments through the order's PayPal link, Wero payments through its Wero link. Cash payments drop out then.
  - *Order date:* from/to
  - *Unpaid:* switch "Include amounts not paid yet", off by default. The payment type of an unpaid amount isn't known yet: the *Payment type* filter doesn't apply to it, and the link filters compare with the order's PayPal or Wero link.
  - *Archive:* switch "Include archived orders", off by default. While it is off, the list states how many payments from archived orders are hidden, and filter chips that only come from archived orders are not offered.
- **Unticking:** whole orders (checkbox in the header, half-ticked for a partial selection) or single payments can be left out; the total updates right away. "Select all"/"Select none" apply to the payments currently shown.
- **Own debts** (optional, switch "Add my open debts"): the open amounts from `getOpenDebts` (the same as in the red badge), each can be unticked; with a "Paid by" filter set, only debts to those people. They are added to the total — someone who collected money for another person and passes it on in cash pays their own debts to that person along with it.
- **Adjustment (±):** a free amount, e.g. cash already handed over (negative).
- **Result:** Payments + Not paid yet + My debts ± Adjustment = Total (red if negative), pinned to the bottom of the dialog.

Technical: the dialog is the fragment `fragments/payment-calculator.html`, the logic lives in `static/js/payment-calculator.js`. Every time it opens it loads `GET /orders/payment-calculator/data` (`PaymentCalculatorService`; amounts in cents so the browser adds them up without rounding errors); filtering and adding up happen in the browser. The browser remembers the filters and switches in `localStorage` (`yy-payment-calculator`), unticked payments only while the page is open. On phones the filter block starts collapsed; a badge shows the number of active filters.

### User statistics

The overview (`/`, `AppUserService.getStatsForUser`) and the `/users` page (`getAllUserStats`) count an order when `OrderService.isParticipant` is true: on item orders with at least one item, on cost splits every person who joined (they have no items).

- **Orders joined:** number of these participations
- **Total spent** (`/users` only): sum of the paid participations, each own items + `getPerPersonCharge` (tip share or cost share)
- **Open payments / Amount due:** from `getOpenDebts`, so the same figures as the badge in the navbar

### Year-end review "Wrapped"

A year-end review in story format (like Spotify Wrapped): slides to tap through with one year's figures, first for everyone and per location, then for the logged-in user. Only completed years are offered: Wrapped 2026 is available from 1 January 2027 on (`WrappedService.isAvailable`).

- `GET /wrapped` (`wrapped-years.html`) lists all past years with orders as cards, newest first, each with orders, paid in total, most popular dish and the user's own orders and spending (`WrappedService.getYearSummaries`). A click plays that year's story. While there is no completed year with orders yet, one card announces the running year for 1 January. The × leads to the dashboard.
- `GET /wrapped?year=2025` (`wrapped.html`) plays that year's story. The running, a future, an invalid or a missing year leads back to the overview. The × and the last slide ("All years") lead to the overview as well.

**What counts** (`WrappedService`): orders dated in the chosen year with status CLOSED or ARCHIVED (their amounts are final) and at least one participant according to `OrderService.isParticipant`. Open and ordered orders only count once they are closed; orders without a location only count on the "together" slide.

**Per location (Kassel, Frankfurt) and overall:**

| Figure | Calculation |
|--------|-------------|
| Orders | number of counted orders |
| Dishes | sum of all item quantities (cost splits have no items) |
| Paid in total | item sum + tip of item orders, plus `splitTotal` of cost splits |
| Tip in total | sum of `tipAmount` of item orders |
| Ø tip per order | tip in total ÷ number of item orders (including those without a tip), plus its share of the item value in percent |
| People | number of distinct participants |
| Most popular dishes | top 3 by quantity. Items with the same name (ignoring case) are added up across menu lists; shown with the restaurant the dish came from most often |
| Favourite place, busiest weekday | by number of orders (`placeName` or `orderDate`) |
| Biggest feast | the order with the most participants |

If at least two locations have orders, one slide compares them directly (orders, dishes, paid in total, Ø tip, people); the highest value gets a crown.

**Personal** (logged-in user):

| Figure | Calculation |
|--------|-------------|
| Spent | per participation own items + `getPerPersonCharge` (tip share or cost share), paid or not |
| Orders, Ø per order, dishes, cost splits | from the user's own participations |
| Top dishes | top 3 by quantity, grouped as above |
| First / last order | date and restaurant |
| Favourite day, hungriest month, favourite place | by number of own orders |
| Biggest order | the user's highest amount on one order |
| Tip share | sum of the user's tip shares |
| Organised | counted orders the user created |
| Advanced the money | counted orders the user is the payee of (`paidByName`, else the creator – as for open payments), with the total amount |
| Ranking | place by number of orders among everyone who ordered that year (same number = same place); only shown in the top three or the top half |

On a tie, the entry that came up first in the year wins. The location where the user ordered most often comes first. Anyone who took part in no order that year gets a short note instead of the personal slides.

**Hint in January:** Throughout January, every page with a logged-in user (the overview `/` and all subpages, but not `/wrapped` itself and not the public `/version`) shows a small hint "🎁 Your 2026 Wrapped" at the bottom right, linking straight to the past year's story (`/wrapped?year=2026`). For this, `WrappedHintAdvice` (`@ControllerAdvice`) adds `wrappedYear` (the past year) to every model if that year has orders; outside January or without orders it is `null`. The fragment `fragments/theme.html` then renders the hint as a `<template>` in `<head>`, and `static/js/wrapped-hint.js` places it in `<body>`. The × shrinks it to the gift icon; the browser remembers that per year in `localStorage` (`yy-wrapped-hint-min`). Outside January, `/wrapped` stays reachable but is not linked anywhere.

**Preview for testing:** `/wrapped?preview=on` makes the Wrapped rules act, for the user's own browser session, as if it were already 1 January of next year (`WrappedPreview`). The running year then shows up in the overview and as a story (with the orders so far, marked "Preview · orders so far"), and the January hint appears on every page. The overview shows a preview notice with "End preview" (`/wrapped?preview=off`); otherwise the preview ends with the session. Other users are not affected. The parameter survives the name entry.

**Release notes:** There the feature is deliberately only mentioned as "A secret statistics feature", without details.

**Rendering:** `wrapped.html` renders each slide as a `<section class="wr-slide">`. `static/js/wrapped.js` turns them into a story: tapping on the right, arrow right, space or swiping left moves on; the left third, arrow left or swiping right goes back. Bars at the top show the progress, the slide number is kept in the URL hash (reloading stays on the slide), and big numbers count up when they appear (not with `prefers-reduced-motion`). Without JavaScript the slides are shown one below the other. Styles: `static/css/wrapped.css`.

---

## 9. Configuration

All settings are in `src/main/resources/application.properties`.

| Property                                 | Value / Description                                    |
|------------------------------------------|--------------------------------------------------------|
| `server.port`                            | `38443`                                                |
| `spring.datasource.url`                  | `jdbc:h2:file:./data/yatta_yam_yam_db` (persistent)   |
| `spring.jpa.hibernate.ddl-auto`          | `update` (schema updated automatically on startup)     |
| `spring.security.user.name`              | `yatta`                                                |
| `spring.security.user.password`          | From environment variable `YATTA_YAM_YAM_PASSWORD`     |
| `spring.servlet.multipart.max-file-size` | `100MB`                                                |
| `spring.thymeleaf.cache`                 | `false`                                                |

### Environment Variables

| Variable                   | Required | Description                         |
|----------------------------|----------|-------------------------------------|
| `YATTA_YAM_YAM_PASSWORD`   | Yes      | Shared access password for all users (Spring Security) |

### File Uploads

Uploaded item and contact images are stored under `uploads/` in the working directory and served via `/uploads/{filename}`.

### H2 Console

Available at `http://localhost:38443/h2-console`:
- JDBC URL: `jdbc:h2:file:./data/yatta_yam_yam_db`
- Username: `sa`
- Password: *(empty)*

---

## 10. Local Setup

### Prerequisites

- Java 17+
- Maven 3.6+

### Run

```bash
# Set environment variable
export YATTA_YAM_YAM_PASSWORD=yourPassword

# Start the app
mvn spring-boot:run
```

Application available at: `http://localhost:38443`

### Build as JAR

```bash
mvn package
java -DYATTA_YAM_YAM_PASSWORD=yourPassword -jar target/yatta-yam-yam-1.12.0.jar
```

---

## 11. Project Structure

```
Yatta-Yam-Yam/
├── pom.xml
└── src/main/
    ├── java/com/nameapp/
    │   ├── YattaYamYamApplication.java       # Spring Boot entry point
    │   ├── config/
    │   │   ├── DatabaseMigration.java        # Database migration logic
    │   │   ├── OpenDebtInterceptor.java      # The user's open amounts for the navbar badge
    │   │   ├── SecurityConfig.java           # Spring Security configuration
    │   │   ├── WebConfig.java                # Web configuration (e.g. static resources)
    │   │   ├── WrappedHintAdvice.java        # wrappedYear in January for the Wrapped hint
    │   │   └── WrappedPreview.java           # Wrapped preview for testing (?preview=on, per session)
    │   ├── controller/
    │   │   ├── ContactController.java        # Contact book: list, create, edit, delete
    │   │   ├── LoginController.java          # Cookie login, user flow, /users, /version
    │   │   ├── OrderController.java          # Orders, selections, payments, item management
    │   │   └── WrappedController.java        # Year-end review /wrapped
    │   ├── model/
    │   │   ├── AppUser.java                  # User entity
    │   │   ├── Contact.java                  # Contact (name, location, address, phone numbers, image)
    │   │   ├── FoodOrder.java                # Order entity (incl. status and location enums)
    │   │   ├── Item.java                     # Single menu item
    │   │   ├── ItemList.java                 # Menu list (collection of items)
    │   │   ├── SelectionItem.java            # Links UserOrderSelection to Item + quantity
    │   │   └── UserOrderSelection.java       # User's selection for an order
    │   ├── repository/
    │   │   ├── AppUserRepository.java
    │   │   ├── ContactRepository.java
    │   │   ├── FoodOrderRepository.java
    │   │   ├── ItemListRepository.java
    │   │   ├── ItemRepository.java
    │   │   ├── SelectionItemRepository.java
    │   │   └── UserOrderSelectionRepository.java
    │   └── service/
    │       ├── AppUserService.java           # Create/rename users, statistics
    │       ├── ContactService.java           # Save contacts (incl. image upload), delete
    │       ├── OrderService.java             # Order logic, cost calculation, payments
    │       ├── PaymentCalculatorService.java # Data for the payment calculator (read-only)
    │       └── WrappedService.java           # Figures for the year-end review
    └── resources/
        ├── application.properties
        ├── static/
        │   ├── css/
        │   │   ├── christmas.css             # Christmas look (inert outside the season)
        │   │   ├── dashboard.css
        │   │   ├── easter.css                # Easter look (inert outside the season)
        │   │   ├── garlic.css                # Garlic look (inert outside its two days)
        │   │   ├── gta.css                   # GTA VI homage (link-only, no season)
        │   │   ├── halloween.css             # Halloween look (inert outside the season)
        │   │   ├── mario.css                 # Super Mario homage (MAR10 Day, 10 March)
        │   │   ├── muertos.css               # Día de los Muertos look (inert outside the season)
        │   │   ├── pasta.css                 # Pasta look (link-only, no season)
        │   │   ├── pelmeni.css               # Pelmeni look (link-only, no season)
        │   │   ├── pokemon.css               # Pokémon homage (link-only, no season)
        │   │   ├── pizza.css                 # Pizza look (inert outside Pizza week)
        │   │   ├── style.css                 # Base styles + colour tokens (--yy-*) for light/dark
        │   │   ├── symbolics.css             # Easter egg: Symbolics mode (inert unless enabled)
        │   │   ├── visitors.css              # Visitors: stage and animations
        │   │   └── wrapped.css               # Slides of the year-end review
        │   ├── images/
        │   │   ├── favicon.svg
        │   │   └── logo.png
        │   └── js/
        │       ├── christmas.js              # Christmas visitors: Santa and the reindeer
        │       ├── easter.js                 # Easter visitors: the Easter bunny and a chick
        │       ├── garlic.js                 # Garlic visitors: garlic bulb, bat, vampire
        │       ├── gta.js                    # GTA visitors: car chase, helicopter, speedboat, flamingo, bag of cash
        │       ├── halloween.js              # Halloween visitors: witch, skeleton, ghost, spider, cat
        │       ├── mario.js                  # Mario visitors: pixel chef, broccoli, bird with pizza, brick block
        │       ├── muertos.js                # Día de los Muertos visitors: monarchs, Catrina, guitar skeleton
        │       ├── pasta.js                  # Pasta visitors: farfalle, meatball, pasta parade
        │       ├── payment-calculator.js     # Payment calculator on the dashboard: filters, unticking, totals
        │       ├── pelmeni.js                # Pelmeni visitors: spoon surfer, dumpling parade, fork
        │       ├── pokemon.js                # Pokémon visitors: made-up pixel lunch monsters, roast chicken, cartridge
        │       ├── pizza.js                  # Pizza visitors: flying pizza, pizza slice, pizzaiolo
        │       ├── theme-info.js             # (i) button in the menu bar with notes on the current look
        │       ├── theme.js                  # Light/dark from the OS setting, seasonal looks, Symbolics easter egg
        │       ├── visitors.js               # Visitors: schedule, motions, call words
        │       ├── wrapped-hint.js           # January: hint for the year-end review at the bottom right
        │       └── wrapped.js                # Story navigation of the year-end review
        └── templates/                        # Thymeleaf HTML templates
            ├── index.html                    # Name input
            ├── confirm.html                  # Confirm existing user
            ├── confirm-new.html              # Confirm new account
            ├── welcome.html                  # Welcome screen after login (with list of open payments)
            ├── login.html                    # Spring Security login
            ├── dashboard.html                # Open orders overview
            ├── archive.html                  # Archive
            ├── order-create.html             # Create new order
            ├── order-detail.html             # Order detail & item selection
            ├── order-edit.html               # Edit order
            ├── order-close.html              # Close order
            ├── item-edit.html                # Edit item
            ├── contacts.html                 # Contact book (list with location filter)
            ├── contact-edit.html             # Create / edit contact
            ├── itemlists.html                # Hidden page: all menu lists + visibility toggle
            ├── themes.html                   # Hidden page: all looks with preview links
            ├── users.html                    # User statistics
            ├── version.html                  # Version info
            ├── wrapped.html                  # Year-end review "Wrapped" (story slides of one year)
            ├── wrapped-years.html            # Wrapped: overview of all past years
            └── fragments/
                ├── open-debt-badge.html      # Red badge with the open amount next to the name
                ├── payment-calculator.html   # "Payment calculator" dialog on the dashboard
                └── theme.html                # <head> include: theme scripts and styles, in January the Wrapped hint
```

---

## 12. Colour Scheme (Dark Mode)

The app follows the light/dark setting of the operating system; there is no toggle of its own.

- `static/js/theme.js` is loaded in the `<head>` of every page through the fragment `fragments/theme.html`. Before the first paint it sets `data-bs-theme="light"` or `"dark"` on `<html>` from `prefers-color-scheme`, and it updates the attribute live when the OS setting changes (e.g. automatic dark mode in the evening).
- Bootstrap 5.3 switches its own components with this attribute. Everything the app paints itself (`style.css`, `dashboard.css`, the inline styles of `welcome.html`) uses the `--yy-*` CSS variables defined at the top of `style.css`, with one set of values for light and one for dark.
- The logo (`logo.png`, black line art on an opaque white background) carries the class `app-logo` and is inverted in dark mode.

**Rules for new pages and styles:**
- Include `<th:block th:replace="~{fragments/theme :: head}"></th:block>` as the last element of `<head>`.
- No hard-coded colours: use the `--yy-*` tokens or Bootstrap variables (`--bs-body-bg`, `--bs-border-color`, `--bs-secondary-color`, …).
- Avoid `bg-light` and `text-bg-light`, which stay light in dark mode; use `bg-body-tertiary` and `text-body-emphasis`. Centred single-card pages use `<body class="page-muted">`.
- Exception: the slides of `/wrapped` (`wrapped.css`, variables `--wr-*`) deliberately keep their own vivid colours in light and dark mode (white text on a saturated gradient); only the page around them follows the theme.

### Seasonal looks: holidays and food days

At seven times of the year the app dresses up by itself. `theme.js` checks the browser's local date on every page load and sets `data-yy-theme` on `<html>` (`pizza`, `mario`, `easter`, `garlic`, `halloween`, `muertos`, `christmas`); no server code, no configuration. Every look still follows the OS light/dark setting and has its own light and dark palette.

**Pizza** – the week around Pizza Day (9 February): from 6 up to and including 12 February. Tomato-red menu bar with a red-and-white striped pizzeria awning, basil-green buttons, every avatar turned into a pizza (the initial on the mozzarella), toppings (pepperoni, basil, olives, mushrooms, tomatoes) drifting down behind the content, a red-and-white checked tablecloth with pizza, olive oil, basil and shakers along the bottom edge (44 px of room at the bottom), a 🍕 next to the app name; palettes "trattoria" / "wood-fire night". Styles: `static/css/pizza.css`.

**Super Mario homage** ("Lunch World 1-1") – only on MAR10 Day (10 March, which written the short way reads "MAR10"), from 0:00 to 23:59. A nod to the 8-bit jump-and-run days, as our own pixel art – no characters, enemies, items, logos, music or level graphics from the games (no plumber, mushrooms, turtles, "?" blocks or pipes). A brick-wall menu bar with spinning coins hanging under it, red buttons, every avatar turned into a big pixel coin with the initial, coins and brick debris drifting down, ground blocks with bushes and coins along the bottom edge (48 px of room at the bottom), a 🕹️ next to the app name. Light mode is the overworld (brown bricks, pale sky), dark mode goes underground (blue bricks). The (i) modal carries a homage from a kid of the 8-bit console days; the note in Symbolics mode calls the occasion "MAR10 Day" (`occasion` in `theme-info.js`). When 10 March falls into the Easter weeks (only with Easter Sunday on 22 or 23 March, last in 2008), Mario wins on that day. Styles: `static/css/mario.css`.

**Easter** – from the Monday two weeks before Easter Sunday (the Monday before Palm Sunday), 0:00, up to and including Easter Monday (off again from the Tuesday after, 0:00). Easter Sunday is computed with the Gregorian computus (anonymous Gregorian algorithm); in 2027 the look runs from 15 to 29 March. Sky-blue menu bar with a string of painted Easter eggs that swing gently, pink buttons and avatars, bunny ears on every avatar, blossom petals drifting down behind the content, a meadow with hidden eggs and flowers along the bottom edge (every page gets 40 px of room at the bottom for it), a 🐣 next to the app name; palettes "spring morning" / "spring night". Styles: `static/css/easter.css`.

**Garlic** – only on Garlic Day (19 April) and Garlic Lovers Day (6 October), each from 0:00 to 23:59. Olive-green menu bar with a swinging garlic braid, garlic-purple buttons, every avatar turned into a garlic bulb (the initial in the middle), garlic cloves drifting down behind the content, a garlic patch with a whiff rising from it along the bottom edge (46 px of room at the bottom), a 🧄 next to the app name; palettes "kitchen" / "garden night". Styles: `static/css/garlic.css`. When 19 April falls into the Easter weeks (e.g. 2025, or Good Friday 2030), garlic wins on that one day.

**Halloween** – from 18 October, 0:00, up to and including 31 October (off again from 1 November, 0:00). Night-purple menu bar with a string of flickering pumpkin lanterns, orange buttons, every avatar turned into a skull (eye sockets above the initial, teeth below it – the initial stays readable), autumn leaves drifting down behind the content, a graveyard with tombstones, a fence and pumpkins along the bottom edge (every page gets 44 px of room at the bottom for it), a 🎃 next to the app name; palettes "misty dusk" / "haunted night". Styles: `static/css/halloween.css`.

**Día de los Muertos** (the Mexican Day of the Dead) – in the first week of November (1 to 7 November), right after Halloween (off again from 8 November, 0:00). Rosa-mexicano-to-purple menu bar with a fluttering string of papel picado (cut-paper flags with flowers, diamonds and skulls), pink buttons, every avatar turned into a sugar skull (calavera: flower-ringed eyes, a marigold on the forehead, a stitched smile – the initial stays readable in the middle), cempasúchil (marigold) petals drifting down behind the content, an ofrenda with flickering candles, marigolds and little sugar skulls along the bottom edge (every page gets 50 px of room at the bottom for it), a 🌼 next to the app name; palettes "warm day" / "candle night". Styles: `static/css/muertos.css`.

**Christmas** – from the Monday after Totensonntag, 0:00, up to and including 26 December (off again from 27 December, 0:00). Totensonntag (the Sunday of the Dead) is the last Sunday before the first Sunday of Advent, so always between 20 and 26 November (2026: starts on 23 November). Fir-green menu bar with twinkling fairy lights (along the top edge on pages without a menu bar), red buttons and avatars, Santa hats on every avatar, gently falling snow behind the content, a 🎄 next to the app name; palettes "snowy day" / "winter night". Styles: `static/css/christmas.css`.

**Link-only** – looks without a season, to be shared on purpose on particular days (list `LINK_ONLY` in `theme.js`). Like every preview they last in this browser tab until it is closed, and the date never switches them on. Their (i) modal only shows title, announcement and tip (`when: null`, `previewNote: false` in `theme-info.js`).

**Pelmeni** ("Triple-T (Teig-Taschen-Tag)", `?theme=pelmeni`): Gzhel-blue menu bar with a white lace border, beetroot buttons, every avatar turned into a blue-and-white plate of pelmeni (the initial on a dollop of smetana), pelmeni, dill and peppercorns drifting down behind the content, a pastry board with flour, dough circles, a rolling pin and a bowl of pelmeni along the bottom edge (46 px of room at the bottom), a 🥟 next to the app name; palettes "flour-dusted kitchen" / "Siberian night". Styles: `static/css/pelmeni.css`.

**Pasta** ("Pasta Day", `?theme=pasta`): Amalfi-teal menu bar with tagliatelle drying on a wooden pole, tomato-red buttons, every avatar turned into a plate of spaghetti (the initial on a burrata), farfalle, penne, fusilli, shells, basil and parmesan drifting down, a blue-and-white striped tablecloth with a pot of spaghetti, a colander, a jar of penne, parmesan and a plate along the bottom edge (46 px of room at the bottom), a 🍝 next to the app name; palettes "lemon kitchen" / "trattoria night". Styles: `static/css/pasta.css`.

**GTA VI homage** ("Food Order in Vice City", `?theme=gta`): our own drawings in a Miami neon style, nothing from the game (no Rockstar logos, characters, fonts or artwork). Night-purple-to-neon-pink menu bar with flickering neon tubes along its lower edge, pink buttons, every avatar turned into a striped synthwave sun (the initial on it), dollar bills and palm fronds drifting down, an ocean drive skyline with art-deco hotels, palms and the sea along the bottom edge (52 px of room at the bottom, with a neon rim at night), a 🌴 next to the app name; palettes "sunset" / "neon night". The (i) modal carries a homage from a fan who has been waiting since GTA V (2013). Styles: `static/css/gta.css`.

**Pokémon homage** ("A Wild Lunch Appeared!", `?theme=pokemon`): a nod to the 151 and the Red, Blue and Yellow editions on the Game Boy, as our own pixel art – no Pokémon, no Poké Ball, no logos, sprites, music or slogans from the games. The four greens of the old handheld screen (pixels rendered sharp), a dark green menu bar with red, blue and yellow cartridges hanging from a link cable, buttons in the colour of the A/B buttons, every avatar turned into a little green handheld screen with the initial, pixel hearts, stars, notes and leaves drifting down, pixel tall grass with flowers in the three edition colours along the bottom edge (40 px of room at the bottom), a 🎮 next to the app name; palettes "school bus window" / "under the blanket with a torch". The (i) modal carries a homage from a nineties kid. Styles: `static/css/pokemon.css`.

**Overview `/themes`:** a hidden page (not linked anywhere, login required) lists every look as a card: seasonal looks in the order they come next, with their rule, the current or next window (computed from `theme.js`), the number of visitors and the call word; then the link-only looks, Symbolics and the standard look. Each card has a button that opens the dashboard with `?theme=…` in a new tab, and the link to copy. The cards are built in the browser from `window.yyTheme` (`theme.js`), `window.yyThemeInfo` (`theme-info.js`) and `yyVisitors.castOf()` (`visitors.js`), so a new look shows up there by itself.

- **Preview via link:** append `?theme=pizza`, `?theme=mario`, `?theme=easter`, `?theme=garlic`, `?theme=halloween`, `?theme=muertos` or `?theme=christmas` (and the link-only `?theme=pelmeni`, `?theme=pasta`, `?theme=gta`, `?theme=pokemon`) to any page URL (e.g. `/orders/dashboard?theme=pizza`, or `&theme=pizza`). The parameter survives both login steps and is then removed from the address bar. The preview only applies to this browser tab until it is closed (`sessionStorage`, `yy-theme-preview` = the look's name), so a forgotten preview does not linger past the occasion. `?theme=default` ends it earlier.
- **Info button:** while a special look is on (the Symbolics mode included), an (i) button sits at the start of the right-hand group in the menu bar. It opens a Bootstrap modal with the occasion in a few sentences, when the look is shown, a hint at the visitors with their call word and – for a preview – how it ends. `static/js/theme-info.js` adds the button to every page with a menu bar (form pages whose bar only shows the app name get a group of their own on the right) and shows, hides or updates it as soon as `data-yy-theme` changes. The texts live in `INFO` in the same file; pages without a menu bar (login, name entry, welcome page, release notes) have no button.
- **Note in Symbolics mode:** Symbolics hides the seasonal looks. So that its users notice them anyway, an "Incoming message" window appears at the bottom right of every page (above the command line) while Symbolics is on and the date calls for a seasonal look – naming the occasion, with a "Switch to the standard look" button. It switches Symbolics off in place (no reload, form input is kept; without JavaScript the link goes to `?theme=default`), and the seasonal look shows; typing `symbolics` brings the mode back. "Not now" (×) hides the note for the rest of that occasion (`localStorage`, `yy-season-hint-dismissed` = e.g. `christmas:2026`, with the month for garlic, which comes twice a year); the next occasion brings it back. The Symbolics info modal offers the same way back. Built in `theme-info.js` (using `window.yyTheme` from `theme.js`), styled in `symbolics.css`.
- **Precedence:** preview in this tab › Symbolics mode switched on › the day's look (single food days before multi-week holidays) › normal look. Anyone using Symbolics keeps it during the season; switching it off (typing `symbolics` or `?theme=default`) returns to the day's look. There is no switch to opt out of a look.
- With "reduce motion" enabled in the OS (`prefers-reduced-motion`) nothing falls or drifts, garlands, candles and lights stay still and no visitors come.
- Every rule is scoped to the look's `html[data-yy-theme="…"]`, so the files have no effect otherwise. All images (hats, ears, masks, garlands, falling things, bottom edges) are inline SVGs in CSS variables (no extra requests). Falling things sit behind every card with `z-index: -1`; none of it catches clicks.

### Visitors

During a look a visitor crosses the screen every 1–5 minutes (at random), never the same one twice in a row. The appearance in the "Flies" column comes twice as often as the others (for garlic: the dancing garlic bulb; for GTA: the car chase; for Mario: the jumping chef).

| Look (script) | Flies through the upper half | Along the bottom edge | Lets itself down from the top | Peeks in from an edge and waves | Call word |
|---|---|---|---|---|---|
| Pizza (`pizza.js`) | a pizza spinning like a frisbee | a pizza slice dances; a pizzaiolo tosses dough | a pizza slice on a string of cheese | a pizza slice | `pizza` |
| Super Mario homage (`mario.js`) | a bird with a slice of pizza in its beak | a jumping pixel chef with two coins (twice as often); a grumpy broccoli | a brick block on a chain, a coin bouncing out of it | the pixel chef | `mario` |
| Easter (`easter.js`) | the Easter bunny in an egg-shaped balloon | the Easter bunny hops with a basket; a chick dances | – | the Easter bunny or a chick in its egg | `hoppel` |
| Garlic (`garlic.js`) | a bat in a hurry | a garlic bulb dances | a garlic charm on a string | a vampire ("Ugh, garlic!") or a garlic bulb | `knoblauch` |
| Halloween (`halloween.js`) | a witch on her broomstick with a black cat | a skeleton with a bow tie dances; a ghost floats | a spider | a black cat or a ghost ("Boo!") | `spuk` |
| Día de los Muertos (`muertos.js`) | a swarm of monarch butterflies | a Catrina dances; a skeleton with a marigold crown plays the guitar | – | a skeleton in an embroidered shirt, or the Catrina | `calavera` |
| Christmas (`christmas.js`) | Santa in his sleigh with two reindeer | Santa or a reindeer dances | – | Santa or a reindeer | `hohoho` |
| Pelmeni, link-only (`pelmeni.js`) | a pelmen surfing on a wooden spoon | a parade of gyoza, ravioli and pelmen; a pelmen with dill hair dances | a fork with a speared pelmen | a pelmen with a dollop of smetana | `pelmeni` |
| GTA VI homage, link-only (`gta.js`) | a helicopter with a searchlight | a car chase, sports car and police car (twice as often); a speedboat | a bag of cash on a rope | a flamingo in sunglasses | `vicecity` |
| Pokémon homage, link-only (`pokemon.js`) | a donut with wings | a wild BURGLIN with its textbox "A wild BURGLIN appeared!"; a dancing taco; a hopping, steaming roast chicken ("A wild BROILER appeared!", golden brown as a Super Game Boy would have coloured it) | a cartridge (red, blue or yellow) on a link cable | a rice ball | `pokemon` |
| Pasta, link-only (`pasta.js`) | a swarm of farfalle | a meatball with spaghetti hair dances; a parade of penne, fusilli and a shell | a meatball on a strand of spaghetti | a meatball | `pasta` |

- Schedule, motions and call words are handled by `static/js/visitors.js`; the looks' scripts (`static/js/*.js` from the table) only draw the figures and register them with `yyVisitors.add(...)` (all load with `defer`, `visitors.js` first).
- The call word is typed outside a form field; it calls a visitor at once, but only during the matching look.
- The next due time is kept in `sessionStorage` (`yy-visitor-next`), so the rhythm carries on across page loads instead of restarting on every click; if it is already due when a page loads, the visit comes 3 seconds later. If it falls due while the tab is in the background, it comes 3 seconds after the tab is visible again. On the first page of a preview (`?theme=…`) the first visitor appears after 3 seconds.
- The figures are inline SVGs, ignore clicks (`pointer-events: none`) and are removed afterwards. They move with the Web Animations API; arms, legs, ears and wings with CSS (`.yy-v-*` in `static/css/visitors.css`); the thread of a dropping visitor is `.yy-visitor-drop::before` (colour and width per visitor).

### Easter egg: Symbolics mode

A hidden third look styled after symbolics.com, the first .com domain ever registered: a neon retro terminal with scanlines on black, glowing cyan headings and frames, green monospace text, magenta and yellow accents, window title bars with three dots, and a command line at the bottom (`C:\YATTA-YAM-YAM\ORDERS\DASHBOARD>`) that shows the command a click on the item under the mouse would run.

- **On/off:** type `symbolics` anywhere outside a form field, or tap the version badge on `/version` 7 times in a row (works on phones, too).
- **Via link:** append `?theme=symbolics` to any page URL (e.g. `/orders/12?theme=symbolics`, or `&theme=symbolics` if the URL already has parameters); `?theme=default` switches back (and also ends a seasonal preview). The parameter survives both login steps. Once the choice is stored, `theme.js` removes the parameter from the address bar, so reloading or copying the URL does not switch it again.
- The choice is stored per browser in `localStorage` (`yy-theme` = `symbolics`); other open tabs follow. If storage is blocked, the mode lasts for the current page only.
- Styles: `static/css/symbolics.css`. Every rule is scoped to `html[data-yy-theme="symbolics"]`, so the file has no effect otherwise. In this mode `data-bs-theme` is always `dark`, regardless of the OS setting.
- Deliberately not mentioned in the release notes.
