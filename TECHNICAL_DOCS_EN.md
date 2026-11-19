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
- Location filter (Kassel / Frankfurt)
- Per-person tip distribution
- "Cost split" order type: one person buys everything and the total is split equally among everyone who joins
- Tracking of who advanced/fronted the money (with a quick self-fill button)
- Payment tracking (Cash, PayPal, Wero)
- Contact book (name, location, address, phone numbers, image) with a quick lookup in the phone-order dialog
- User statistics (total spend, open amounts)
- Red badge with the open amount next to your own name in the navbar
- Dark mode that follows the operating system setting
- Seasonal looks with occasional visitors: Halloween (18–31 October), Día de los Muertos (1–2 November), Christmas (Monday after Totensonntag until 26 December), Easter (two weeks before Easter until Easter Monday)

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

**Redirect preservation:** When someone without a name cookie opens an order or contact page (`/orders/**`, `/contacts/**`), the URL is stored in the session under `redirectAfterLogin` and restored after name entry. Together with the redirect from step 1, a shared link ends up on the right page after the password and name entry.

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

### Orders (`OrderController`, prefix `/orders`)

| Method | Path                         | Description                                      |
|--------|------------------------------|--------------------------------------------------|
| GET    | `/orders/dashboard`          | Dashboard with open orders                       |
| GET    | `/orders/archive`            | Archive of closed orders                         |
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

### User statistics

The overview (`/`, `AppUserService.getStatsForUser`) and the `/users` page (`getAllUserStats`) count an order when `OrderService.isParticipant` is true: on item orders with at least one item, on cost splits every person who joined (they have no items).

- **Orders joined:** number of these participations
- **Total spent** (`/users` only): sum of the paid participations, each own items + `getPerPersonCharge` (tip share or cost share)
- **Open payments / Amount due:** from `getOpenDebts`, so the same figures as the badge in the navbar

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
    │   │   └── WebConfig.java                # Web configuration (e.g. static resources)
    │   ├── controller/
    │   │   ├── ContactController.java        # Contact book: list, create, edit, delete
    │   │   ├── LoginController.java          # Cookie login, user flow, /users, /version
    │   │   └── OrderController.java          # Orders, selections, payments, item management
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
    │       └── OrderService.java             # Order logic, cost calculation, payments
    └── resources/
        ├── application.properties
        ├── static/
        │   ├── css/
        │   │   ├── christmas.css             # Christmas look (inert outside the season)
        │   │   ├── dashboard.css
        │   │   ├── easter.css                # Easter look (inert outside the season)
        │   │   ├── halloween.css             # Halloween look (inert outside the season)
        │   │   ├── muertos.css               # Día de los Muertos look (inert outside the season)
        │   │   ├── style.css                 # Base styles + colour tokens (--yy-*) for light/dark
        │   │   ├── symbolics.css             # Easter egg: Symbolics mode (inert unless enabled)
        │   │   └── visitors.css              # Visitors: stage and animations
        │   ├── images/
        │   │   ├── favicon.svg
        │   │   └── logo.png
        │   └── js/
        │       ├── christmas.js              # Christmas visitors: Santa and the reindeer
        │       ├── easter.js                 # Easter visitors: the Easter bunny and a chick
        │       ├── halloween.js              # Halloween visitors: witch, skeleton, ghost, spider, cat
        │       ├── muertos.js                # Día de los Muertos visitors: monarchs, Catrina, guitar skeleton
        │       ├── theme.js                  # Light/dark from the OS setting, seasonal looks, Symbolics easter egg
        │       └── visitors.js               # Visitors: schedule, motions, call words
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
            ├── users.html                    # User statistics
            ├── version.html                  # Version info
            └── fragments/
                ├── open-debt-badge.html      # Red badge with the open amount next to the name
                └── theme.html                # <head> include: theme scripts and styles
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

### Seasonal looks: Halloween, Día de los Muertos, Christmas and Easter

At four times of the year the app dresses up by itself. `theme.js` checks the browser's local date on every page load and sets `data-yy-theme="halloween"`, `"muertos"`, `"christmas"` or `"easter"` on `<html>`; no server code, no configuration. Both looks still follow the OS light/dark setting and have their own light and dark palette.

**Halloween** – from 18 October, 0:00, up to and including 31 October (off again from 1 November, 0:00). Night-purple menu bar with a string of flickering pumpkin lanterns, orange buttons, every avatar turned into a skull (eye sockets above the initial, teeth below it – the initial stays readable), autumn leaves drifting down behind the content, a graveyard with tombstones, a fence and pumpkins along the bottom edge (every page gets 44 px of room at the bottom for it), a 🎃 next to the app name; palettes "misty dusk" / "haunted night". Styles: `static/css/halloween.css`.

**Día de los Muertos** (the Mexican Day of the Dead) – on 1 and 2 November, right after Halloween (off again from 3 November, 0:00). Rosa-mexicano-to-purple menu bar with a fluttering string of papel picado (cut-paper flags with flowers, diamonds and skulls), pink buttons, every avatar turned into a sugar skull (calavera: flower-ringed eyes, a marigold on the forehead, a stitched smile – the initial stays readable in the middle), cempasúchil (marigold) petals drifting down behind the content, an ofrenda with flickering candles, marigolds and little sugar skulls along the bottom edge (every page gets 50 px of room at the bottom for it), a 🌼 next to the app name; palettes "warm day" / "candle night". Styles: `static/css/muertos.css`.

**Christmas** – from the Monday after Totensonntag, 0:00, up to and including 26 December (off again from 27 December, 0:00). Totensonntag (the Sunday of the Dead) is the last Sunday before the first Sunday of Advent, so always between 20 and 26 November (2026: starts on 23 November). Fir-green menu bar with twinkling fairy lights (along the top edge on pages without a menu bar), red buttons and avatars, Santa hats on every avatar, gently falling snow behind the content, a 🎄 next to the app name; palettes "snowy day" / "winter night". Styles: `static/css/christmas.css`.

**Easter** – from the Monday two weeks before Easter Sunday (the Monday before Palm Sunday), 0:00, up to and including Easter Monday (off again from the Tuesday after, 0:00). Easter Sunday is computed with the Gregorian computus (anonymous Gregorian algorithm); in 2027 the look runs from 15 to 29 March. Sky-blue menu bar with a string of painted Easter eggs that swing gently, pink buttons and avatars, bunny ears on every avatar, blossom petals drifting down behind the content, a meadow with hidden eggs and flowers along the bottom edge (every page gets 40 px of room at the bottom for it), a 🐣 next to the app name; palettes "spring morning" / "spring night". Styles: `static/css/easter.css`.

- **Preview via link:** append `?theme=halloween`, `?theme=muertos`, `?theme=christmas` or `?theme=easter` to any page URL (e.g. `/orders/dashboard?theme=easter`, or `&theme=easter`). The parameter survives both login steps and is then removed from the address bar. The preview only applies to this browser tab until it is closed (`sessionStorage`, `yy-theme-preview` = the look's name), so a forgotten preview does not linger past the holiday. `?theme=default` ends it earlier.
- **Precedence:** preview in this tab › Symbolics mode switched on › seasonal look › normal look. Anyone using Symbolics keeps it during the season; switching it off (typing `symbolics` or `?theme=default`) returns to the seasonal look in season. There is no switch to opt out of a seasonal look.
- With "reduce motion" enabled in the OS (`prefers-reduced-motion`) no leaves or snow fall and no petals drift, lanterns, candles, flags, lights and eggs stay still and no visitors come.
- Every rule is scoped to the season's `html[data-yy-theme="…"]`, so the files have no effect otherwise. Hat, ears, skulls, lights, lanterns, flags, eggs, leaves, snow, petals, meadow, graveyard and ofrenda are inline SVGs in CSS variables (no extra requests). Leaves, snow and petals sit behind every card with `z-index: -1`; none of it catches clicks.

### Visitors

During a seasonal look a visitor crosses the screen every 1–5 minutes (at random), never the same one twice in a row:

| | Halloween (`halloween.js`) | Día de los Muertos (`muertos.js`) | Christmas (`christmas.js`) | Easter (`easter.js`) |
|---|---|---|---|---|
| Flying through the upper half (twice as often) | a witch on her broomstick, a black cat riding at the back | a small swarm of monarch butterflies | Santa in his sleigh with two reindeer | the Easter bunny in the basket of an egg-shaped hot-air balloon |
| Along the bottom edge | a skeleton with a bow tie dances; a ghost floats | a Catrina in her flower hat dances; a skeleton with a marigold crown plays the guitar | Santa or a reindeer dances | the Easter bunny hops with a basket of eggs; a chick with an eggshell cap dances |
| Letting itself down from the top on a thread, waving, climbing back | a spider | – | – | – |
| Peeking in from the left, right or bottom edge and waving | a black cat or a ghost ("Boo!") | a skeleton in an embroidered shirt, or the Catrina | Santa or a reindeer | the Easter bunny or a chick in its egg |
| Call one at once: type outside a form field | `spuk` | `calavera` | `hohoho` | `hoppel` |

- Schedule, motions and call words are handled by `static/js/visitors.js`; the seasonal scripts (`static/js/halloween.js`, `muertos.js`, `christmas.js`, `easter.js`) only draw the figures and register them with `yyVisitors.add(...)` (the scripts load with `defer` in this order).
- The next due time is kept in `sessionStorage` (`yy-visitor-next`), so the rhythm carries on across page loads instead of restarting on every click; if it is already due when a page loads, the visit comes 3 seconds later. If it falls due while the tab is in the background, it comes 3 seconds after the tab is visible again. On the first page of a preview (`?theme=…`) the first visitor appears after 3 seconds.
- The figures are inline SVGs, ignore clicks (`pointer-events: none`) and are removed afterwards. They move with the Web Animations API; arms, legs, ears and wings with CSS (`.yy-v-*` in `static/css/visitors.css`); the spider's thread is `.yy-visitor-drop::before`.

### Easter egg: Symbolics mode

A hidden third look styled after symbolics.com, the first .com domain ever registered: a neon retro terminal with scanlines on black, glowing cyan headings and frames, green monospace text, magenta and yellow accents, window title bars with three dots, and a command line at the bottom (`C:\YATTA-YAM-YAM\ORDERS\DASHBOARD>`) that shows the command a click on the item under the mouse would run.

- **On/off:** type `symbolics` anywhere outside a form field, or tap the version badge on `/version` 7 times in a row (works on phones, too).
- **Via link:** append `?theme=symbolics` to any page URL (e.g. `/orders/12?theme=symbolics`, or `&theme=symbolics` if the URL already has parameters); `?theme=default` switches back (and also ends a seasonal preview). The parameter survives both login steps. Once the choice is stored, `theme.js` removes the parameter from the address bar, so reloading or copying the URL does not switch it again.
- The choice is stored per browser in `localStorage` (`yy-theme` = `symbolics`); other open tabs follow. If storage is blocked, the mode lasts for the current page only.
- Styles: `static/css/symbolics.css`. Every rule is scoped to `html[data-yy-theme="symbolics"]`, so the file has no effect otherwise. In this mode `data-bs-theme` is always `dark`, regardless of the OS setting.
- Deliberately not mentioned in the release notes.
