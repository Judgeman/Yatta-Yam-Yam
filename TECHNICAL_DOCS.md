# Yatta-Yam-Yam – Technische Dokumentation

**Version:** 1.11.0  
**Stand:** November 2026

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
12. [Farbschema (Dark Mode)](#12-farbschema-dark-mode)

---

## 1. Projektübersicht

Yatta-Yam-Yam ist eine interne Web-App zur kollektiven Essensbestellung. Nutzer wählen Speisen aus vordefinierten Menülisten aus, der Ersteller der Bestellung telefoniert die Sammelliste durch und verwaltet anschließend die Zahlungseingänge.

**Kernfunktionen:**
- Gemeinsames Zugangspasswort für die App, danach namensbasierte Anmeldung ohne persönliches Passwort (Cookie)
- Verwaltung von Bestellungen mit Statuslebenszyklus
- Wiederverwendbare Menülisten mit Sichtbarkeitsschalter (ausgeblendete Listen erscheinen nicht bei neuen Bestellungen)
- Standortfilter (Kassel / Frankfurt)
- Trinkgeldverteilung pro Kopf
- Bestellart „Cost split": eine Person kauft alles ein, der Gesamtbetrag wird gleichmäßig auf alle Angemeldeten verteilt
- Erfassung, wer das Geld ausgelegt hat (mit Schnellauswahl per Knopf)
- Zahlungsverfolgung (Bar, PayPal, Wero)
- Kontaktbuch (Name, Standort, Adresse, Telefonnummern, Bild) mit Schnellnachschlagen im Telefonbestell-Dialog
- Benutzerstatistiken (Gesamtausgaben, offene Beträge)
- Rotes Badge mit dem offenen Betrag neben dem eigenen Namen in der Menüleiste
- Dark Mode, der der Einstellung des Betriebssystems folgt

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

**Zwei Anmeldestufen, nacheinander:**

| Stufe | Mechanismus | Zweck |
|-------|-------------|-------|
| 1. Zugangspasswort (`/login`) | Spring Security Form-Login mit Remember-Me | Schaltet die App frei – ein gemeinsames Konto `yatta` für alle Nutzer |
| 2. Name (`nameapp_user`) | Eigene Implementierung via `LoginController` | Legt fest, wer man in der App ist (kein persönliches Passwort) |

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
| `paidByName`       | String           | Name der Person, die das Geld ausgelegt hat (beim Anlegen, Schließen und Bearbeiten angebbar, per Knopf "I'm paying" mit dem eigenen Namen vorbelegbar) |
| `orderType`        | OrderType        | ITEMS (Artikelauswahl aus Menüliste) oder SPLIT (Kostenaufteilung); `null` bei Altbestand = ITEMS |
| `splitTotal`       | BigDecimal       | Nur SPLIT: Gesamtbetrag, der auf alle Teilnehmer aufgeteilt wird. Beim Anlegen optional, zum Schließen Pflicht |

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
| `visible` | boolean   | Ob die Liste beim Anlegen einer neuen Bestellung angeboten wird (Standard `true`); versehentlich erstellte Listen können über die versteckte Menülisten-Seite ausgeblendet werden |
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

### Contact

Eintrag im Kontaktbuch (z. B. Restaurant oder Lieferdienst). Unabhängig von den übrigen Entitäten.

| Feld           | Typ           | Beschreibung                                        |
|----------------|---------------|-----------------------------------------------------|
| `id`           | Long (PK)     |                                                     |
| `name`         | String        | Name des Kontakts (Pflicht)                         |
| `location`     | Location      | KASSEL oder FRANKFURT (Pflicht, gleiches Enum wie bei `FoodOrder`) |
| `address`      | String        | Adresse (optional)                                  |
| `phoneNumbers` | List<String>  | Beliebig viele Telefonnummern, Reihenfolge bleibt erhalten (Tabelle `contact_phone_number`) |
| `imageUrl`     | String        | Bild-URL oder Pfad zu hochgeladenem Bild (optional) |

### SelectionItem

| Feld        | Typ                  | Beschreibung              |
|-------------|----------------------|---------------------------|
| `id`        | Long (PK)            |                           |
| `selection` | UserOrderSelection   | Zugehörige Auswahl        |
| `item`      | Item                 | Ausgewähltes Gericht      |
| `quantity`  | int                  | Bestellte Menge           |

---

## 5. Authentifizierung & Session

Der Zugriff läuft in zwei Stufen: Zuerst schaltet ein gemeinsames Zugangspasswort die App frei (Spring Security), danach gibt sich jeder Nutzer über seinen Namen zu erkennen (eigener Cookie). Das Passwort schützt die App nach außen; der Name legt nur fest, wer man in der App ist, und ist durch kein persönliches Passwort geschützt.

### Stufe 1: Zugangspasswort (Spring Security)

Spring Security schützt alle Routen. Öffentlich zugänglich (ohne Passwort) sind nur:
- `/css/**`, `/js/**`, `/images/**`, `/uploads/**`
- `/version`

Jeder andere Aufruf – auch die Namenseingabe auf `/` und die H2-Konsole – leitet nicht angemeldete Besucher auf `/login` um. Dort gibt man das gemeinsame Zugangspasswort ein; der Benutzername `yatta` steckt als verstecktes Feld im Formular. Das Konto wird in `application.properties` konfiguriert:
```
spring.security.user.name=yatta
spring.security.user.password=${YATTA_YAM_YAM_PASSWORD}
```

Nach erfolgreicher Eingabe leitet Spring Security auf die ursprünglich aufgerufene URL weiter, sonst auf `/`.

Remember-Me ist immer aktiv (verstecktes Feld `remember-me=true`) und hat eine Token-Gültigkeit von einem Jahr. Pro Browser muss das Passwort also nur einmal im Jahr eingegeben werden. Die Oberfläche hat keinen Logout-Button; „Switch Account" löscht nur den Namens-Cookie aus Stufe 2, nicht die Passwort-Anmeldung.

Der CSRF-Schutz ist für `POST /login` abgeschaltet (`csrf.ignoringRequestMatchers("/login")`). Das CSRF-Token liegt in der serverseitigen Session; war diese beim Absenden abgelaufen (Timeout, Neustart, wiederhergestellter Tab), wurde der Login stillschweigend abgelehnt und der Nutzer landete erneut auf `/login`. Da es nur ein gemeinsames Konto gibt, bringt Login-CSRF einem Angreifer nichts. Alle übrigen Formulare bleiben CSRF-geschützt.

### Stufe 2: Namens-Login (Cookie)

Nach dem Passwort identifiziert sich jeder Nutzer über seinen Namen. Die Identität wird in einem HttpOnly-Cookie `nameapp_user` gespeichert, der den URL-encodierten Nutzernamen enthält. Die Controller lesen diesen Cookie selbst; fehlt er oder ist der Name unbekannt, leiten sie auf `/` zur Namenseingabe um.

**Ablauf:**
1. `GET /` — Existiert ein Cookie mit bekanntem Namen → direkt eingeloggt
2. `POST /check-name` — Name in DB vorhanden → Bestätigungsseite; neu → Account anlegen
3. `POST /confirm-login` / `POST /confirm-new-login` — Cookie setzen, Weiterleitung

Der Cookie hat eine Ablaufzeit von `Integer.MAX_VALUE` Sekunden (~68 Jahre), ist `HttpOnly` und gilt für den Pfad `/`.

**Redirect-Preservation:** Ruft jemand ohne Namens-Cookie eine Bestell- oder Kontaktseite auf (`/orders/**`, `/contacts/**`), wird die URL in der Session unter `redirectAfterLogin` gespeichert und nach der Namenseingabe wiederhergestellt. Zusammen mit der Weiterleitung aus Stufe 1 landet ein geteilter Link so nach Passwort und Namenseingabe auf der richtigen Seite.

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
| GET     | `/login`           | Zugangspasswort eingeben (Spring Security)         |
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
| POST    | `/orders/{id}/close`                        | Bestellung schließen (Status → CLOSED); `tipAmount` oder `totalAmount` |
| POST    | `/orders/{id}/archive`                      | Bestellung archivieren (Status → ARCHIVED)|
| POST    | `/orders/{id}/reopen`                       | Bestellung wiedereröffnen (Status → OPEN) |
| POST    | `/orders/{id}/mark-ordered`                 | Als telefonisch bestellt markieren (Status → ORDERED) |
| POST    | `/orders/{id}/select`                       | Artikelauswahl des Nutzers speichern      |
| POST    | `/orders/{id}/join`                         | Cost split: teilnehmen (nur Status OPEN)  |
| POST    | `/orders/{id}/leave`                        | Cost split: wieder abmelden (nur Status OPEN) |

### Artikel & Menülisten

| Methode | Pfad                                                    | Beschreibung                        |
|---------|---------------------------------------------------------|-------------------------------------|
| GET     | `/orders/itemlists`                                     | Alle Menülisten auflisten + Sichtbarkeit umschalten (versteckte Seite, nirgends verlinkt) |
| POST    | `/orders/itemlists/{listId}/visibility`                 | Menüliste ein-/ausblenden           |
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

### Kontakte (`ContactController`, Präfix `/contacts`)

| Methode | Pfad                     | Beschreibung                                               |
|---------|--------------------------|------------------------------------------------------------|
| GET     | `/contacts`              | Kontaktliste, optional gefiltert (`?location=KASSEL`)      |
| GET     | `/contacts/new`          | Formular: Neuer Kontakt                                    |
| POST    | `/contacts/new`          | Kontakt anlegen                                            |
| GET     | `/contacts/{id}/edit`    | Formular: Kontakt bearbeiten                               |
| POST    | `/contacts/{id}/edit`    | Kontakt aktualisieren                                      |
| POST    | `/contacts/{id}/delete`  | Kontakt löschen                                            |

Das Kontaktbuch ist über den Knopf „Contacts“ im Dashboard erreichbar. Im Telefonbestell-Dialog der Bestelldetailseite öffnet das Kontaktbuch-Symbol ein reines Nachschlage-Pop-up (ohne Bearbeiten) mit allen Kontakten und ihren Nummern; Kontakte am Standort der Bestellung stehen oben.

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
   - Optional können bereits hier „Paid By" sowie PayPal- und Wero-Link angegeben werden, falls schon bekannt.
   - PayPal- und Wero-Link sind mit den Links aus der letzten Bestellung des Erstellers vorbelegt und können angepasst oder geleert werden.
   - Zur Auswahl werden nur **sichtbare** Menülisten angeboten.
   - Beim direkten Anlegen einer neuen Liste steuert eine Checkbox „Diese Artikelliste nächstes Mal verwenden" (vorausgewählt, aber abwählbar), ob die Liste für zukünftige Bestellungen sichtbar bleibt.
2. **Teilnehmer wählen Speisen** — Jeder Nutzer wählt Menüpositionen mit Mengen aus. Die Auswahl wird als `UserOrderSelection` mit `SelectionItem`-Einträgen gespeichert.
3. **Als bestellt markieren** (ORDERED) — Ersteller gibt an, wer telefonisch bestellt hat. Nutzer sehen eine Warnung, wenn sie danach noch ihre Auswahl ändern.
4. **Bestellung schließen** (CLOSED) — Ersteller gibt optional das Gesamttrinkgeld **oder** den insgesamt bezahlten Betrag ein (das jeweils andere Feld wird berechnet: Trinkgeld = Gesamtbetrag − Bestellsumme) und kann „Paid By" sowie PayPal- und Wero-Link ergänzen oder korrigieren. Das Trinkgeld wird gleichmäßig auf alle Teilnehmer mit mindestens einem Artikel aufgeteilt.
5. **Zahlungen verwalten** — Nutzer markieren sich selbst als bezahlt; Ersteller kann Zahlungen bestätigen oder widerrufen.
6. **Archivieren** (ARCHIVED) — Bestellung verschwindet aus dem Dashboard und landet im Archiv.

### Trinkgeldberechnung

```java
tipPerPerson = tipAmount / anzahl_teilnehmer_mit_items
// Rundung: HALF_UP auf 2 Nachkommastellen

// Nur Gesamtbetrag angegeben (totalAmount, ohne tipAmount):
tipAmount = totalAmount - summe_aller_auswahlen   // nur wenn >= 0
```

### Bestellart „Cost split" (SPLIT)

Eine Person kauft alles ein; es gibt keine Menüliste und keine Artikel. Nutzer melden sich per „I'm in" an (eine `UserOrderSelection` ohne `SelectionItem`s) und können sich, solange die Bestellung OPEN ist, wieder abmelden. Jede angemeldete Person ist zahlungspflichtiger Teilnehmer.

- **Beim Anlegen** ist der Gesamtbetrag (`splitTotal`) optional. Trinkgeld, Menüliste, Telefonbestellung und der Status ORDERED entfallen.
- **Solange offen** sehen Teilnehmer nur die Teilnehmerzahl und melden sich an. Nur der Ersteller sieht Beträge: den Gesamtbetrag und den *aktuellen Höchstbetrag* pro Person (sinkt mit jeder weiteren Anmeldung; auch auf seiner Dashboard-Kachel), ohne Gesamtbetrag einen Rechner: Preis pro Person × Teilnehmer = Gesamtbetrag. Endbetrag und Bezahlmöglichkeiten erscheinen für alle erst nach dem Schließen.
- **Beim Schließen** gibt der Ersteller entweder den Gesamtbetrag (`splitTotal`) oder einen Preis pro Person (`splitPerPerson`) ein; das jeweils andere Feld wird berechnet. Kommt nur `splitPerPerson` an, setzt der Server `splitTotal = splitPerPerson × teilnehmer`. Ohne Betrag wird nicht geschlossen.

```java
splitShare = splitTotal / anzahl_teilnehmer
// Rundung: UP auf 2 Nachkommastellen, damit die auslegende Person keine Cents verliert
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
- **Für alle:** Ist ein Bezahler (`paidByName`) eingetragen, zeigt die Kachel „Paid by <Name>“ unter dem Ersteller

### Offene Beträge in der Menüleiste

Schuldet ein Nutzer noch Geld, steht neben seinem Namen in der Menüleiste (Dashboard, Bestelldetail, Archiv, Kontakte) ein rotes Badge mit dem offenen Gesamtbetrag. So wird er auch dann erinnert, wenn er nur über einen geteilten Link auf eine neue Bestellung kommt. Ein Klick auf Name oder Badge führt zur persönlichen Übersicht (`/`), die unter „Still to pay“ jede offene Bestellung mit Betrag und Empfänger auflistet und auf die Bestellung verlinkt.

Gezählt wird jede Teilnahme (`isParticipant`, also auch Cost splits), die
- zu einer Bestellung im Status **CLOSED** gehört (archivierte zählen nicht, dort kann man sich nicht mehr selbst als bezahlt markieren),
- weder selbst als bezahlt markiert noch vom Ersteller bestätigt ist und
- nicht dem Empfänger selbst gehört. Empfänger ist der Bezahler (`paidByName`, ohne Beachtung der Groß-/Kleinschreibung), ohne eingetragenen Bezahler der Ersteller.

Betrag je Bestellung = eigene Artikel + Trinkgeldanteil bzw. Kostenanteil (`OrderService.getOpenDebts`). Die Kacheln „Open payments“ und „Amount due“ auf der Übersicht und die gleichnamigen Spalten unter `/users` nutzen dieselbe Berechnung. Der `OpenDebtInterceptor` legt `openDebts` und `openDebtTotal` in das Model jeder Seite, die einen `user` enthält. Das Badge selbst ist das Fragment `fragments/open-debt-badge.html`.

### Nutzerstatistiken

Die Übersicht (`/`, `AppUserService.getStatsForUser`) und die Seite `/users` (`getAllUserStats`) zählen eine Bestellung, wenn `OrderService.isParticipant` zutrifft: bei Artikelbestellungen mit mindestens einem Artikel, bei Cost splits jede Anmeldung (die keine Artikel hat).

- **Orders joined:** Anzahl dieser Teilnahmen
- **Total spent** (nur `/users`): Summe der bezahlten Teilnahmen, je eigene Artikel + `getPerPersonCharge` (Trinkgeldanteil bzw. Kostenanteil)
- **Open payments / Amount due:** aus `getOpenDebts`, also dieselben Werte wie das Badge in der Menüleiste

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
| `YATTA_YAM_YAM_PASSWORD`   | Ja      | Gemeinsames Zugangspasswort für alle Nutzer (Spring Security) |

### Datei-Uploads

Hochgeladene Artikel- und Kontaktbilder werden unter `uploads/` im Arbeitsverzeichnis gespeichert und über den Pfad `/uploads/{filename}` ausgeliefert.

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
java -DYATTA_YAM_YAM_PASSWORD=deinPasswort -jar target/yatta-yam-yam-1.11.0.jar
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
    │   │   ├── OpenDebtInterceptor.java      # Offene Beträge des Nutzers für das Badge in der Menüleiste
    │   │   ├── SecurityConfig.java           # Spring Security Konfiguration
    │   │   └── WebConfig.java                # Web-Konfiguration (z. B. statische Ressourcen)
    │   ├── controller/
    │   │   ├── ContactController.java        # Kontaktbuch: Liste, Anlegen, Bearbeiten, Löschen
    │   │   ├── LoginController.java          # Cookie-Login, Nutzer-Flow, /users, /version
    │   │   └── OrderController.java          # Bestellungen, Auswahl, Zahlungen, Artikelverwaltung
    │   ├── model/
    │   │   ├── AppUser.java                  # Nutzer-Entität
    │   │   ├── Contact.java                  # Kontakt (Name, Standort, Adresse, Telefonnummern, Bild)
    │   │   ├── FoodOrder.java                # Bestellungs-Entität (inkl. Status- und Standort-Enum)
    │   │   ├── Item.java                     # Einzelner Menüartikel
    │   │   ├── ItemList.java                 # Menüliste (Sammlung von Items)
    │   │   ├── SelectionItem.java            # Verbindet UserOrderSelection mit Item + Menge
    │   │   └── UserOrderSelection.java       # Nutzerauswahl für eine Bestellung
    │   ├── repository/
    │   │   ├── AppUserRepository.java
    │   │   ├── ContactRepository.java
    │   │   ├── FoodOrderRepository.java
    │   │   ├── ItemListRepository.java
    │   │   ├── ItemRepository.java
    │   │   ├── SelectionItemRepository.java
    │   │   └── UserOrderSelectionRepository.java
    │   └── service/
    │       ├── AppUserService.java           # Nutzer anlegen, umbenennen, Statistiken
    │       ├── ContactService.java           # Kontakte speichern (inkl. Bild-Upload), löschen
    │       └── OrderService.java             # Bestelllogik, Kostenberechnung, Zahlungen
    └── resources/
        ├── application.properties
        ├── static/
        │   ├── css/
        │   │   ├── dashboard.css
        │   │   ├── style.css                 # Basis-Styles + Farb-Tokens (--yy-*) für hell/dunkel
        │   │   └── symbolics.css             # Easter Egg: Symbolics-Modus (ohne Wirkung, solange aus)
        │   ├── images/
        │   │   ├── favicon.svg
        │   │   └── logo.png
        │   └── js/
        │       └── theme.js                  # Hell/dunkel nach Systemeinstellung, Symbolics-Easter-Egg
        └── templates/                        # Thymeleaf HTML-Templates
            ├── index.html                    # Namenseingabe
            ├── confirm.html                  # Bestehenden Nutzer bestätigen
            ├── confirm-new.html              # Neuen Account bestätigen
            ├── welcome.html                  # Willkommensseite nach Login (mit Liste offener Zahlungen)
            ├── login.html                    # Spring Security Login
            ├── dashboard.html                # Übersicht offener Bestellungen
            ├── archive.html                  # Archiv
            ├── order-create.html             # Neue Bestellung erstellen
            ├── order-detail.html             # Bestelldetail & Artikelauswahl
            ├── order-edit.html               # Bestellung bearbeiten
            ├── order-close.html              # Bestellung schließen
            ├── item-edit.html                # Artikel bearbeiten
            ├── contacts.html                 # Kontaktbuch (Liste mit Standortfilter)
            ├── contact-edit.html             # Kontakt anlegen / bearbeiten
            ├── itemlists.html                # Versteckte Seite: alle Menülisten + Sichtbarkeitsschalter
            ├── users.html                    # Nutzerstatistiken
            ├── version.html                  # Versionsinfo
            └── fragments/
                ├── open-debt-badge.html      # Rotes Badge mit offenem Betrag neben dem Namen
                └── theme.html                # Einbindung im <head>: theme.js + symbolics.css
```

---

## 12. Farbschema (Dark Mode)

Die App folgt der Hell/Dunkel-Einstellung des Betriebssystems; einen eigenen Umschalter gibt es nicht.

- `static/js/theme.js` wird über das Fragment `fragments/theme.html` im `<head>` jeder Seite geladen. Es setzt vor dem ersten Rendern `data-bs-theme="light"` bzw. `"dark"` auf `<html>` (aus `prefers-color-scheme`) und passt das Attribut live an, wenn sich die Systemeinstellung ändert (z. B. automatischer Dark Mode am Abend).
- Bootstrap 5.3 schaltet seine Komponenten über dieses Attribut um. Alles, was die App selbst einfärbt (`style.css`, `dashboard.css`, die Inline-Styles von `welcome.html`), nutzt die CSS-Variablen `--yy-*` oben in `style.css` – mit je einem Wertesatz für hell und dunkel.
- Das Logo (`logo.png`, schwarze Strichzeichnung auf deckend weißem Grund) hat die Klasse `app-logo` und wird im Dark Mode invertiert.

**Regeln für neue Seiten und Styles:**
- `<th:block th:replace="~{fragments/theme :: head}"></th:block>` als letztes Element im `<head>` einbinden.
- Keine fest codierten Farben: `--yy-*`-Tokens oder Bootstrap-Variablen (`--bs-body-bg`, `--bs-border-color`, `--bs-secondary-color`, …) verwenden.
- `bg-light` und `text-bg-light` vermeiden, sie bleiben im Dark Mode hell; stattdessen `bg-body-tertiary` und `text-body-emphasis`. Zentrierte Ein-Karten-Seiten nutzen `<body class="page-muted">`.

### Easter Egg: Symbolics-Modus

Ein versteckter dritter Look im Stil von symbolics.com, der ersten jemals registrierten .com-Domain: Neon-Retro-Terminal mit Scanlines auf Schwarz, leuchtenden cyanfarbenen Überschriften und Rahmen, grüner Monospace-Schrift, Magenta- und Gelb-Akzenten, Fenstertiteln mit drei Punkten und einer Kommandozeile am unteren Rand (`C:\YATTA-YAM-YAM\ORDERS\DASHBOARD>`), die anzeigt, welchen Befehl ein Klick auf das Element unter dem Mauszeiger ausführen würde.

- **Ein/aus:** irgendwo außerhalb eines Formularfelds `symbolics` tippen oder auf `/version` 7-mal hintereinander auf das Versions-Badge tippen (funktioniert auch auf dem Handy).
- **Per Link:** `?theme=symbolics` an die URL einer beliebigen Seite hängen (z. B. `/orders/12?theme=symbolics`, bzw. `&theme=symbolics`, wenn die URL schon Parameter hat); `?theme=default` schaltet zurück. Der Parameter übersteht beide Login-Schritte. Sobald die Wahl gespeichert ist, entfernt `theme.js` ihn aus der Adressleiste, damit Neuladen oder Kopieren der URL nicht erneut umschaltet.
- Die Wahl wird pro Browser in `localStorage` gespeichert (`yy-theme` = `symbolics`); andere offene Tabs ziehen mit. Ist der Speicher blockiert, gilt der Modus nur für die aktuelle Seite.
- Styles: `static/css/symbolics.css`. Alle Regeln sind auf `html[data-yy-theme="symbolics"]` beschränkt, die Datei wirkt also sonst nicht. In diesem Modus ist `data-bs-theme` unabhängig von der Systemeinstellung immer `dark`.
- Bewusst nicht in den Release Notes erwähnt.
