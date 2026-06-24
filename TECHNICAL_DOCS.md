# Yatta-Yam-Yam – Technische Dokumentation

**Version:** 1.5.0  
**Stand:** April 2026

---

## Inhaltsverzeichnis

1. [Projektübersicht](#1-projektübersicht)
2. [Tech-Stack](#2-tech-stack)
3. [Architektur](#3-architektur)
4. [Datenmodell](#4-datenmodell)
5. [Authentifizierung & Session](#5-authentifizierung--session)
6. [Routen-Referenz](#6-routen-referenz)
7. [Bestellablauf](#7-bestellablauf)
8. [Zahlungsabwicklung](#8-zahlungsabwicklung)
9. [Konfiguration](#9-konfiguration)
10. [Lokales Setup](#10-lokales-setup)
11. [Projektstruktur](#11-projektstruktur)

---

## 1. Projektübersicht

Yatta-Yam-Yam ist eine interne Web-App zur kollektiven Essensbestellung. Nutzer wählen Speisen aus vordefinierten Menülisten aus, der Ersteller der Bestellung telefoniert die Sammelliste durch und verwaltet anschließend die Zahlungseingänge.

**Kernfunktionen:**
- Namenbasierter Login ohne Passwort (Cookie-Session)
- Verwaltung von Bestellungen mit Statuslebenszyklus
- Standortfilter (Kassel / Frankfurt)
- Trinkgeldverteilung pro Kopf
- Zahlungsverfolgung (Bar, PayPal, Wero)
- Benutzerstatistiken (Gesamtausgaben, offene Beträge)

---

## 2. Tech-Stack

| Schicht        | Technologie                          |
|----------------|--------------------------------------|
| Backend        | Spring Boot 3.2.3, Spring MVC        |
| Security       | Spring Security 6                    |
| ORM            | Hibernate / Spring Data JPA          |
| Datenbank      | H2 (dateibasiert, persistiert)       |
| Templates      | Thymeleaf 3                          |
| Frontend       | Bootstrap 5.3                        |
| Build          | Maven 3 / Java 17                    |

---

## 3. Architektur

Die Anwendung folgt dem klassischen MVC-Muster mit einem einzelnen Deployment-Artefakt (Fat JAR).

```
Browser
  │
  ▼
Spring MVC Controller
  │         │
  │         ▼
  │     Thymeleaf-Template → HTML-Response
  │
  ▼
Service-Layer (Business-Logik)
  │
  ▼
Spring Data JPA Repository
  │
  ▼
H2-Datenbank (Datei: ./data/yatta_yam_yam_db)
```

**Zwei parallele Authentifizierungspfade:**

| Pfad | Mechanismus | Nutzergruppe |
|------|-------------|--------------|
| Cookie (`nameapp_user`) | Eigene Implementierung via `LoginController` | Alle App-Nutzer |
| HTTP-Login (`/login`) | Spring Security Form-Login | Admin-Zugang (z. B. H2-Konsole) |

---

## 4. Datenmodell

### Entitäten und Beziehungen

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

| Feld           | Typ        | Beschreibung                          |
|----------------|------------|---------------------------------------|
| `id`           | Long (PK)  | Auto-generierter Primärschlüssel      |
| `name`         | String     | Einzigartiger Benutzername (case-insensitive) |
| `registeredAt` | LocalDate  | Automatisch gesetzt via `@PrePersist` |

### FoodOrder

| Feld               | Typ              | Beschreibung                                         |
|--------------------|------------------|------------------------------------------------------|
| `id`               | Long (PK)        |                                                      |
| `placeName`        | String           | Name des Restaurants                                 |
| `orderDate`        | LocalDate        |                                                      |
| `creator`          | AppUser (FK)     | Ersteller / Verantwortlicher                         |
| `itemList`         | ItemList (FK)    | Verknüpfte Menüliste (optional)                      |
| `status`           | OrderStatus      | OPEN, ORDERED, CLOSED, ARCHIVED                      |
| `location`         | Location         | KASSEL oder FRANKFURT (optional)                     |
| `tipAmount`        | BigDecimal       | Gesamttrinkgeld (wird gleichmäßig aufgeteilt)        |
| `paypalLink`       | String           | PayPal.me-Link des Erstellers                        |
| `weroLink`         | String           | Wero-Link des Erstellers                             |
| `orderedByContact` | String           | Name der Person, die telefonisch bestellt hat        |

**OrderStatus-Lebenszyklus:**

```
OPEN ──► ORDERED ──► CLOSED ──► ARCHIVED
  ▲           │
  └───────────┘  (Reopen möglich aus ORDERED oder CLOSED)
```

### ItemList

| Feld      | Typ       | Beschreibung                   |
|-----------|-----------|--------------------------------|
| `id`      | Long (PK) |                                |
| `name`    | String    | Bezeichnung der Menüliste      |
| `creator` | AppUser   | Ersteller der Liste            |
| `items`   | List<Item>| Enthaltene Speisepositionen    |

### Item

| Feld       | Typ       | Beschreibung                               |
|------------|-----------|--------------------------------------------|
| `id`       | Long (PK) |                                            |
| `name`     | String    | Bezeichnung des Gerichts                   |
| `price`    | BigDecimal| Preis in Euro                              |
| `imageUrl` | String    | Bild-URL oder Pfad zu hochgeladenem Bild   |
| `itemList` | ItemList  | Zugehörige Menüliste                       |

### UserOrderSelection

Verknüpft einen Nutzer mit einer Bestellung und enthält seine Artikelauswahl sowie den Zahlungsstatus.

| Feld                | Typ            | Beschreibung                                       |
|---------------------|----------------|----------------------------------------------------|
| `id`                | Long (PK)      |                                                    |
| `order`             | FoodOrder      | Zugehörige Bestellung                              |
| `user`              | AppUser        | Teilnehmender Nutzer                               |
| `items`             | List<SelectionItem> | Ausgewählte Artikel                           |
| `paid`              | boolean        | Nutzer hat selbst als bezahlt markiert             |
| `markedPaidByOwner` | boolean        | Ersteller hat Zahlung bestätigt                    |
| `paymentMethod`     | PaymentMethod  | CASH, PAYPAL oder WERO                             |

`getSubtotal()` berechnet die Summe aller `(Preis × Menge)` der Artikel.

### SelectionItem

| Feld        | Typ                  | Beschreibung              |
|-------------|----------------------|---------------------------|
| `id`        | Long (PK)            |                           |
| `selection` | UserOrderSelection   | Zugehörige Auswahl        |
| `item`      | Item                 | Ausgewähltes Gericht      |
| `quantity`  | int                  | Bestellte Menge           |

---

## 5. Authentifizierung & Session

### Cookie-Login (Nutzer)

Der primäre Anmeldeweg erfolgt über einen HttpOnly-Cookie `nameapp_user`, der den URL-encodierten Nutzernamen enthält.

**Ablauf:**
1. `GET /` — Existiert ein Cookie mit bekanntem Namen → direkt eingeloggt
2. `POST /check-name` — Name in DB vorhanden → Bestätigungsseite; neu → Account anlegen
3. `POST /confirm-login` / `POST /confirm-new-login` — Cookie setzen, Weiterleitung

Der Cookie hat eine Ablaufzeit von `Integer.MAX_VALUE` Sekunden (~68 Jahre), ist `HttpOnly` und gilt für den Pfad `/`.

**Redirect-Preservation:** Wenn ein nicht eingeloggter Nutzer eine geschützte URL aufruft, wird die URL in der Session unter `redirectAfterLogin` gespeichert und nach dem Login wiederhergestellt.

### Spring Security (Admin)

Spring Security schützt alle Routen. Öffentlich zugänglich (ohne Login) sind:
- `/css/**`, `/js/**`, `/images/**`, `/uploads/**`
- `/version`

Für den Cookie-basierten Nutzer-Login ist kein Spring-Security-Login notwendig, da die Routen durch den `LoginController` und die Cookie-Prüfung in den Controllern selbst abgesichert werden.

Der Admin-Zugang (z. B. für die H2-Konsole) läuft über `/login` und wird via `application.properties` konfiguriert:
```
spring.security.user.name=yatta
spring.security.user.password=${YATTA_YAM_YAM_PASSWORD}
```

Remember-Me ist aktiviert mit einer Token-Gültigkeit von einem Jahr.

---

## 6. Routen-Referenz

### Login-Flow (`LoginController`)

| Methode | Pfad               | Beschreibung                                      |
|---------|--------------------|---------------------------------------------------|
| GET     | `/`                | Home: Auto-Login per Cookie oder Namenseingabe    |
| POST    | `/check-name`      | Name prüfen: bekannt → Bestätigung, neu → Account |
| POST    | `/confirm-login`   | Bestehenden Nutzer einloggen, Cookie setzen        |
| POST    | `/not-me`          | Zurück zur Namenseingabe                           |
| POST    | `/confirm-new-login` | Neuen Nutzer einloggen, Cookie setzen            |
| POST    | `/switch-account`  | Cookie löschen, zurück zu `/`                     |
| GET     | `/login`           | Spring Security Login-Seite                        |
| POST    | `/rename`          | Nutzernamen ändern, Cookie aktualisieren           |
| GET     | `/version`         | Versionsseite (öffentlich)                         |
| GET     | `/users`           | Nutzerstatistiken (nur für eingeloggte Nutzer)     |

### Bestellungen (`OrderController`, Präfix `/orders`)

| Methode | Pfad                                        | Beschreibung                              |
|---------|---------------------------------------------|-------------------------------------------|
| GET     | `/orders/dashboard`                         | Dashboard mit offenen Bestellungen        |
| GET     | `/orders/archive`                           | Archiv abgeschlossener Bestellungen       |
| GET     | `/orders/create`                            | Formular: Neue Bestellung                 |
| POST    | `/orders/create`                            | Bestellung anlegen                        |
| GET     | `/orders/{id}`                              | Bestelldetail anzeigen                    |
| GET     | `/orders/{id}/edit`                         | Formular: Bestellung bearbeiten (Ersteller) |
| POST    | `/orders/{id}/edit`                         | Bestellung aktualisieren                  |
| GET     | `/orders/{id}/close`                        | Formular: Bestellung schließen            |
| POST    | `/orders/{id}/close`                        | Bestellung schließen (Status → CLOSED)    |
| POST    | `/orders/{id}/archive`                      | Bestellung archivieren (Status → ARCHIVED)|
| POST    | `/orders/{id}/reopen`                       | Bestellung wiedereröffnen (Status → OPEN) |
| POST    | `/orders/{id}/mark-ordered`                 | Als telefonisch bestellt markieren (Status → ORDERED) |
| POST    | `/orders/{id}/select`                       | Artikelauswahl des Nutzers speichern      |

### Artikel & Menülisten

| Methode | Pfad                                                    | Beschreibung                        |
|---------|---------------------------------------------------------|-------------------------------------|
| GET     | `/orders/itemlist/{listId}/items`                       | Artikel einer Liste verwalten       |
| POST    | `/orders/itemlist/{listId}/items/add`                   | Artikel hinzufügen                  |
| GET     | `/orders/itemlist/{listId}/items/{itemId}/edit`         | Artikel bearbeiten (Formular)       |
| POST    | `/orders/itemlist/{listId}/items/{itemId}/edit`         | Artikel aktualisieren               |
| POST    | `/orders/itemlist/{listId}/items/{itemId}/delete`       | Artikel löschen (nur wenn unbestellt)|
| POST    | `/orders/itemlist/{listId}/rename`                      | Menüliste umbenennen                |

### Zahlungsstatus

| Methode | Pfad                                      | Beschreibung                                  |
|---------|-------------------------------------------|-----------------------------------------------|
| POST    | `/orders/selection/{selId}/pay`           | Nutzer markiert sich selbst als bezahlt       |
| POST    | `/orders/selection/{selId}/unpay`         | Nutzer nimmt eigene Bezahlt-Markierung zurück |
| POST    | `/orders/selection/{selId}/owner-paid`    | Ersteller bestätigt Zahlung eines Nutzers     |
| POST    | `/orders/selection/{selId}/owner-unpaid`  | Ersteller widerruft Zahlungsbestätigung       |

---

## 7. Bestellablauf

### Statusübergänge

```
OPEN
  │  Ersteller klickt „Als bestellt markieren"
  ▼
ORDERED  ←──── (Reopen setzt Status zurück auf OPEN)
  │  Ersteller klickt „Bestellung schließen"
  ▼
CLOSED
  │  Ersteller klickt „Archivieren"
  ▼
ARCHIVED
```

### Detaillierter Ablauf

1. **Bestellung erstellen** — Ersteller wählt Restaurant, Datum, Menüliste und optional Standort.
   - PayPal- und Wero-Links werden automatisch aus der letzten Bestellung des Erstellers übernommen.
2. **Teilnehmer wählen Speisen** — Jeder Nutzer wählt Menüpositionen mit Mengen aus. Die Auswahl wird als `UserOrderSelection` mit `SelectionItem`-Einträgen gespeichert.
3. **Als bestellt markieren** (ORDERED) — Ersteller gibt an, wer telefonisch bestellt hat. Nutzer sehen eine Warnung, wenn sie danach noch ihre Auswahl ändern.
4. **Bestellung schließen** (CLOSED) — Ersteller gibt optionales Gesamttrinkgeld ein. Das Trinkgeld wird gleichmäßig auf alle Teilnehmer mit mindestens einem Artikel aufgeteilt.
5. **Zahlungen verwalten** — Nutzer markieren sich selbst als bezahlt; Ersteller kann Zahlungen bestätigen oder widerrufen.
6. **Archivieren** (ARCHIVED) — Bestellung verschwindet aus dem Dashboard und landet im Archiv.

### Trinkgeldberechnung

```java
tipPerPerson = tipAmount / anzahl_teilnehmer_mit_items
// Rundung: HALF_UP auf 2 Nachkommastellen
```

---

## 8. Zahlungsabwicklung

Unterstützte Zahlungsmethoden (`PaymentMethod`-Enum):

| Methode | Beschreibung                               |
|---------|--------------------------------------------|
| CASH    | Barzahlung                                 |
| PAYPAL  | Zahlung via PayPal.me-Link des Erstellers  |
| WERO    | Zahlung via Wero-Link des Erstellers       |

**Bezahlt-Status:** Eine Auswahl gilt als bezahlt, wenn `paid == true` (Selbstmarkierung) **oder** `markedPaidByOwner == true` (vom Ersteller bestätigt).

**Dashboard-Anzeige:**
- **Für den Ersteller:** Rote Warnung mit Anzahl und Summe offener Zahlungen
- **Für andere Nutzer:** Graue Info-Box mit offenen Beträgen in der Bestellung

---

## 9. Konfiguration

Alle Einstellungen befinden sich in `src/main/resources/application.properties`.

| Eigenschaft                              | Wert / Beschreibung                                    |
|------------------------------------------|--------------------------------------------------------|
| `server.port`                            | `38443`                                                |
| `spring.datasource.url`                  | `jdbc:h2:file:./data/yatta_yam_yam_db` (persistent)   |
| `spring.jpa.hibernate.ddl-auto`          | `update` (Schema wird bei Start automatisch aktualisiert) |
| `spring.security.user.name`              | `yatta`                                                |
| `spring.security.user.password`          | Aus Umgebungsvariable `YATTA_YAM_YAM_PASSWORD`         |
| `spring.servlet.multipart.max-file-size` | `100MB`                                                |
| `spring.thymeleaf.cache`                 | `false`                                                |

### Umgebungsvariablen

| Variable                   | Pflicht | Beschreibung               |
|----------------------------|---------|----------------------------|
| `YATTA_YAM_YAM_PASSWORD`   | Ja      | Admin-Passwort für Spring Security |

### Datei-Uploads

Hochgeladene Artikelbilder werden unter `uploads/` im Arbeitsverzeichnis gespeichert und über den Pfad `/uploads/{filename}` ausgeliefert.

### H2-Konsole

Erreichbar unter `http://localhost:38443/h2-console`:
- JDBC URL: `jdbc:h2:file:./data/yatta_yam_yam_db`
- Benutzername: `sa`
- Passwort: *(leer)*

---

## 10. Lokales Setup

### Voraussetzungen

- Java 17+
- Maven 3.6+

### Starten

```bash
# Umgebungsvariable setzen
export YATTA_YAM_YAM_PASSWORD=deinPasswort

# App starten
mvn spring-boot:run
```

Anwendung erreichbar unter: `http://localhost:38443`

### Build als JAR

```bash
mvn package
java -DYATTA_YAM_YAM_PASSWORD=deinPasswort -jar target/yatta-yam-yam-1.5.0.jar
```

---

## 11. Projektstruktur

```
Yatta-Yam-Yam/
├── pom.xml
└── src/main/
    ├── java/com/nameapp/
    │   ├── YattaYamYamApplication.java       # Spring Boot Entry Point
    │   ├── config/
    │   │   ├── DatabaseMigration.java        # Datenbankmigrationslogik
    │   │   ├── SecurityConfig.java           # Spring Security Konfiguration
    │   │   └── WebConfig.java                # Web-Konfiguration (z. B. statische Ressourcen)
    │   ├── controller/
    │   │   ├── LoginController.java          # Cookie-Login, Nutzer-Flow, /users, /version
    │   │   └── OrderController.java          # Bestellungen, Auswahl, Zahlungen, Artikelverwaltung
    │   ├── model/
    │   │   ├── AppUser.java                  # Nutzer-Entität
    │   │   ├── FoodOrder.java                # Bestellungs-Entität (inkl. Status- und Standort-Enum)
    │   │   ├── Item.java                     # Einzelner Menüartikel
    │   │   ├── ItemList.java                 # Menüliste (Sammlung von Items)
    │   │   ├── SelectionItem.java            # Verbindet UserOrderSelection mit Item + Menge
    │   │   └── UserOrderSelection.java       # Nutzerauswahl für eine Bestellung
    │   ├── repository/
    │   │   ├── AppUserRepository.java
    │   │   ├── FoodOrderRepository.java
    │   │   ├── ItemListRepository.java
    │   │   ├── ItemRepository.java
    │   │   ├── SelectionItemRepository.java
    │   │   └── UserOrderSelectionRepository.java
    │   └── service/
    │       ├── AppUserService.java           # Nutzer anlegen, umbenennen, Statistiken
    │       └── OrderService.java             # Bestelllogik, Kostenberechnung, Zahlungen
    └── resources/
        ├── application.properties
        ├── data.sql                          # Initiale Testdaten (falls vorhanden)
        ├── static/
        │   ├── css/
        │   │   ├── dashboard.css
        │   │   └── style.css
        │   └── images/
        │       ├── favicon.svg
        │       └── logo.png
        └── templates/                        # Thymeleaf HTML-Templates
            ├── index.html                    # Namenseingabe
            ├── confirm.html                  # Bestehenden Nutzer bestätigen
            ├── confirm-new.html              # Neuen Account bestätigen
            ├── welcome.html                  # Willkommensseite nach Login
            ├── login.html                    # Spring Security Login
            ├── dashboard.html                # Übersicht offener Bestellungen
            ├── archive.html                  # Archiv
            ├── order-create.html             # Neue Bestellung erstellen
            ├── order-detail.html             # Bestelldetail & Artikelauswahl
            ├── order-edit.html               # Bestellung bearbeiten
            ├── order-close.html              # Bestellung schließen
            ├── item-edit.html                # Artikel bearbeiten
            ├── users.html                    # Nutzerstatistiken
            └── version.html                  # Versionsinfo
```
