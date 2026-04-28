# Yatta-Yam-Yam – Technical Documentation

**Version:** 1.5.0  
**Date:** April 2026

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

---

## 1. Project Overview

Yatta-Yam-Yam is an internal web application for collective food ordering. Users select dishes from predefined menu lists, the order creator calls the restaurant to place the combined order, and then manages incoming payments.

**Core features:**
- Name-based login without a password (cookie session)
- Order management with a status lifecycle
- Location filter (Kassel / Frankfurt)
- Per-person tip distribution
- Payment tracking (Cash, PayPal, Wero)
- User statistics (total spend, open amounts)

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

**Two parallel authentication paths:**

| Path | Mechanism | User Group |
|------|-----------|------------|
| Cookie (`nameapp_user`) | Custom implementation via `LoginController` | All app users |
| HTTP login (`/login`) | Spring Security form login | Admin access (e.g. H2 console) |

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

### SelectionItem

| Field       | Type                 | Description                        |
|-------------|----------------------|------------------------------------|
| `id`        | Long (PK)            |                                    |
| `selection` | UserOrderSelection   | Parent selection                   |
| `item`      | Item                 | Selected dish                      |
| `quantity`  | int                  | Quantity ordered                   |

---

## 5. Authentication & Session

### Cookie Login (Users)

The primary login path uses an HttpOnly cookie `nameapp_user` containing the URL-encoded username.

**Flow:**
1. `GET /` — Cookie present with a known name → logged in immediately
2. `POST /check-name` — Name found in DB → confirmation screen; new → create account
3. `POST /confirm-login` / `POST /confirm-new-login` — Set cookie, redirect

The cookie has an expiry of `Integer.MAX_VALUE` seconds (~68 years), is `HttpOnly`, and applies to path `/`.

**Redirect preservation:** When an unauthenticated user accesses a protected URL, it is stored in the session under `redirectAfterLogin` and restored after login.

### Spring Security (Admin)

Spring Security protects all routes. Publicly accessible (without login):
- `/css/**`, `/js/**`, `/images/**`, `/uploads/**`
- `/version`

The cookie-based user login does not require a Spring Security login, as the routes are secured by the `LoginController` and the cookie check within the controllers themselves.

Admin access (e.g. for the H2 console) goes through `/login` and is configured in `application.properties`:
```
spring.security.user.name=yatta
spring.security.user.password=${YATTA_YAM_YAM_PASSWORD}
```

Remember-Me is enabled with a token validity of one year.

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
| GET    | `/login`             | Spring Security login page                          |
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
| POST   | `/orders/{id}/close`         | Close order (status → CLOSED)                    |
| POST   | `/orders/{id}/archive`       | Archive order (status → ARCHIVED)                |
| POST   | `/orders/{id}/reopen`        | Reopen order (status → OPEN)                     |
| POST   | `/orders/{id}/mark-ordered`  | Mark as called in (status → ORDERED)             |
| POST   | `/orders/{id}/select`        | Save user's item selection                       |

### Items & Menu Lists

| Method | Path                                                    | Description                           |
|--------|---------------------------------------------------------|---------------------------------------|
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
   - PayPal and Wero links are pre-filled from the creator's most recent order.
2. **Participants select dishes** — Each user picks menu items with quantities. The selection is saved as a `UserOrderSelection` with `SelectionItem` entries.
3. **Mark as ordered** (ORDERED) — Creator records who called in the order. Users see a warning if they try to change their selection afterwards.
4. **Close order** (CLOSED) — Creator optionally enters a total tip. The tip is split evenly among all participants who have at least one item.
5. **Manage payments** — Users mark themselves as paid; the creator can confirm or revoke payments.
6. **Archive** (ARCHIVED) — Order disappears from the dashboard and moves to the archive.

### Tip Calculation

```java
tipPerPerson = tipAmount / numberOfParticipantsWithItems
// Rounding: HALF_UP to 2 decimal places
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
| `YATTA_YAM_YAM_PASSWORD`   | Yes      | Admin password for Spring Security  |

### File Uploads

Uploaded item images are stored under `uploads/` in the working directory and served via `/uploads/{filename}`.

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
java -DYATTA_YAM_YAM_PASSWORD=yourPassword -jar target/yatta-yam-yam-1.5.0.jar
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
    │   │   ├── SecurityConfig.java           # Spring Security configuration
    │   │   └── WebConfig.java                # Web configuration (e.g. static resources)
    │   ├── controller/
    │   │   ├── LoginController.java          # Cookie login, user flow, /users, /version
    │   │   └── OrderController.java          # Orders, selections, payments, item management
    │   ├── model/
    │   │   ├── AppUser.java                  # User entity
    │   │   ├── FoodOrder.java                # Order entity (incl. status and location enums)
    │   │   ├── Item.java                     # Single menu item
    │   │   ├── ItemList.java                 # Menu list (collection of items)
    │   │   ├── SelectionItem.java            # Links UserOrderSelection to Item + quantity
    │   │   └── UserOrderSelection.java       # User's selection for an order
    │   ├── repository/
    │   │   ├── AppUserRepository.java
    │   │   ├── FoodOrderRepository.java
    │   │   ├── ItemListRepository.java
    │   │   ├── ItemRepository.java
    │   │   ├── SelectionItemRepository.java
    │   │   └── UserOrderSelectionRepository.java
    │   └── service/
    │       ├── AppUserService.java           # Create/rename users, statistics
    │       └── OrderService.java             # Order logic, cost calculation, payments
    └── resources/
        ├── application.properties
        ├── data.sql                          # Initial seed data (if present)
        ├── static/
        │   ├── css/
        │   │   ├── dashboard.css
        │   │   └── style.css
        │   └── images/
        │       ├── favicon.svg
        │       └── logo.png
        └── templates/                        # Thymeleaf HTML templates
            ├── index.html                    # Name input
            ├── confirm.html                  # Confirm existing user
            ├── confirm-new.html              # Confirm new account
            ├── welcome.html                  # Welcome screen after login
            ├── login.html                    # Spring Security login
            ├── dashboard.html                # Open orders overview
            ├── archive.html                  # Archive
            ├── order-create.html             # Create new order
            ├── order-detail.html             # Order detail & item selection
            ├── order-edit.html               # Edit order
            ├── order-close.html              # Close order
            ├── item-edit.html                # Edit item
            ├── users.html                    # User statistics
            └── version.html                  # Version info
```
