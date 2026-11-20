# Yatta-Yam-Yam – Technische Dokumentation

**Version:** 1.12.0  
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
- Artikelbilder in der Bestellung per Klick groß ansehen (Modal mit Name und Preis, Blättern per Pfeil, Pfeiltaste oder Wischen)
- Standortfilter (Kassel / Frankfurt)
- Trinkgeldverteilung pro Kopf
- Bestellart „Cost split": eine Person kauft alles ein, der Gesamtbetrag wird gleichmäßig auf alle Angemeldeten verteilt
- Erfassung, wer das Geld ausgelegt hat (mit Schnellauswahl per Knopf)
- Zahlungsverfolgung (Bar, PayPal, Wero)
- Kontaktbuch (Name, Standort, Adresse, Telefonnummern, Bild) mit Schnellnachschlagen im Telefonbestell-Dialog
- Benutzerstatistiken (Gesamtausgaben, offene Beträge)
- Rotes Badge mit dem offenen Betrag neben dem eigenen Namen in der Menüleiste
- Dark Mode, der der Einstellung des Betriebssystems folgt
- Saisonale Looks mit gelegentlichen Besuchern: Pizza (6.–12. Februar), Ostern (zwei Wochen vor Ostern bis Ostermontag), Knoblauch (19. April und 6. Oktober), Halloween (18.–31. Oktober), Día de los Muertos (1.–7. November), Weihnachten (Montag nach Totensonntag bis 26. Dezember)
- Jahresrückblick „Wrapped“ mit Statistik pro Standort und pro Person (`/wrapped`)

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

**Redirect-Preservation:** Ruft jemand ohne Namens-Cookie eine Bestell- oder Kontaktseite auf (`/orders/**`, `/contacts/**`) oder den Jahresrückblick (`/wrapped`), wird die URL in der Session unter `redirectAfterLogin` gespeichert und nach der Namenseingabe wiederhergestellt. Zusammen mit der Weiterleitung aus Stufe 1 landet ein geteilter Link so nach Passwort und Namenseingabe auf der richtigen Seite.

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
| GET     | `/themes`          | Alle Looks mit Vorschau-Links (versteckte Seite, nirgends verlinkt; nur für eingeloggte Nutzer) |

### Jahresrückblick (`WrappedController`)

| Methode | Pfad               | Beschreibung                                      |
|---------|--------------------|---------------------------------------------------|
| GET     | `/wrapped`         | Übersicht aller vergangenen Jahre mit Bestellungen |
| GET     | `/wrapped?year=2025` | Story „Wrapped“ dieses Jahres                    |

### Bestellungen (`OrderController`, Präfix `/orders`)

| Methode | Pfad                                        | Beschreibung                              |
|---------|---------------------------------------------|-------------------------------------------|
| GET     | `/orders/dashboard`                         | Dashboard mit offenen Bestellungen        |
| GET     | `/orders/archive`                           | Archiv abgeschlossener Bestellungen       |
| GET     | `/orders/payment-calculator/data`           | JSON für den Zahlungsrechner: alle Zahlungen + eigene offene Beträge |
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

### Zahlungsrechner (Dashboard)

Der Knopf „Calculator“ neben „New Order“ öffnet ein Pop-up, das Zahlungen aus Bestellungen auflistet und zusammenrechnet – etwa wenn jemand Geld per PayPal über eine andere Person einsammelt und diese den Betrag bar weitergibt. Alternativ öffnen es das Tastenkürzel **Alt+C** (Mac: **⌥C**) auf dem Dashboard und der Link `/orders/dashboard?calculator` (der Parameter übersteht beide Login-Schritte und wird danach aus der Adressleiste entfernt). Ein kurzer Hinweis oben im Pop-up erklärt den Zweck. Der Rechner ändert keine Daten und steht allen Nutzern zur Verfügung.

- **Zahlungen:** jede Teilnahme (`isParticipant`), die selbst als bezahlt markiert oder vom Ersteller bestätigt ist, in Bestellungen jedes Status. Archivierte Bestellungen sind standardmäßig ausgeblendet (siehe Filter *Archive*). Betrag = eigene Artikel + Trinkgeld- bzw. Kostenanteil (`getPerPersonCharge`). Gruppiert nach Bestellung (neueste zuerst) mit Ort, Datum, Ersteller und – falls abweichend – Bezahler; jede Zeile zeigt Teilnehmer, Zahlungsart und Betrag.
- **Noch nicht bezahlt** (optional, siehe Filter *Unpaid*): Teilnahmen an Bestellungen im Status CLOSED, die weder selbst als bezahlt markiert noch vom Ersteller bestätigt sind – nach denselben Regeln wie `getOpenDebts`, also ohne den Empfänger selbst. Die eigenen offenen Beträge des Betrachters fehlen hier, sie stehen unter *Eigene Schulden* und würden sonst doppelt zählen. Sie erscheinen als Zeilen mit „Not paid yet“ und zählen wie Zahlungen zur Summe.
- **Filter** (Mehrfachauswahl; keine Auswahl = keine Einschränkung; verschiedene Filter gelten zusammen):
  - *Paid by:* Empfänger des Geldes (`OrderService.getPayee`: `paidByName`, sonst der Ersteller; ohne Beachtung der Groß-/Kleinschreibung)
  - *Payment type:* PayPal, Wero, Cash (bei alten Datensätzen ohne Zahlungsart zusätzlich „Not specified“)
  - *PayPal link / Wero link:* die Links der Bestellungen. Ist mindestens ein Link gewählt, zählen nur Zahlungen, die über einen gewählten Link liefen – PayPal-Zahlungen über den PayPal-Link der Bestellung, Wero-Zahlungen über den Wero-Link. Barzahlungen fallen dann heraus.
  - *Order date:* von/bis
  - *Unpaid:* Schalter „Include amounts not paid yet“, standardmäßig aus. Für noch nicht bezahlte Beträge ist die Zahlungsart unbekannt: Der Filter *Payment type* gilt für sie nicht, die Link-Filter vergleichen mit dem PayPal- bzw. Wero-Link der Bestellung.
  - *Archive:* Schalter „Include archived orders“, standardmäßig aus. Solange er aus ist, nennt die Liste die Zahl der ausgeblendeten Zahlungen aus archivierten Bestellungen, und Filter-Chips, die nur aus archivierten Bestellungen stammen, werden nicht angeboten.
- **Abwählen:** Ganze Bestellungen (Checkbox im Kopf, halb gesetzt bei teilweiser Auswahl) oder einzelne Zahlungen lassen sich abwählen; die Summe aktualisiert sich sofort. „Select all“/„Select none“ betreffen die gerade sichtbaren Zahlungen.
- **Eigene Schulden** (optional, Schalter „Add my open debts“): die offenen Beträge aus `getOpenDebts` (dieselben wie im roten Badge), einzeln abwählbar; bei gesetztem „Paid by“-Filter nur die an diese Empfänger. Sie werden zur Summe addiert – wer Geld für jemanden eingesammelt hat und es bar weitergibt, zahlt so die eigenen Schulden bei dieser Person gleich mit.
- **Adjustment (±):** freier Betrag, z. B. bereits bar übergebenes Geld (negativ).
- **Ergebnis:** Payments + Not paid yet + My debts ± Adjustment = Total (negativ in Rot), fest am unteren Rand des Pop-ups.

Technik: Das Pop-up ist das Fragment `fragments/payment-calculator.html`, die Logik steckt in `static/js/payment-calculator.js`. Bei jedem Öffnen lädt es `GET /orders/payment-calculator/data` (`PaymentCalculatorService`; Beträge in Cent, damit der Browser ohne Rundungsfehler rechnet); gefiltert und summiert wird im Browser. Filter und Schalter merkt sich der Browser in `localStorage` (`yy-payment-calculator`), abgewählte Zahlungen nur, solange die Seite offen ist. Auf dem Handy ist der Filterbereich anfangs eingeklappt; ein Badge zeigt die Zahl aktiver Filter.

### Nutzerstatistiken

Die Übersicht (`/`, `AppUserService.getStatsForUser`) und die Seite `/users` (`getAllUserStats`) zählen eine Bestellung, wenn `OrderService.isParticipant` zutrifft: bei Artikelbestellungen mit mindestens einem Artikel, bei Cost splits jede Anmeldung (die keine Artikel hat).

- **Orders joined:** Anzahl dieser Teilnahmen
- **Total spent** (nur `/users`): Summe der bezahlten Teilnahmen, je eigene Artikel + `getPerPersonCharge` (Trinkgeldanteil bzw. Kostenanteil)
- **Open payments / Amount due:** aus `getOpenDebts`, also dieselben Werte wie das Badge in der Menüleiste

### Jahresrückblick „Wrapped“

Ein Jahresrückblick im Story-Format (wie Spotify Wrapped): Folien zum Durchtippen mit den Zahlen eines Jahres, erst für alle und pro Standort, dann für den angemeldeten Nutzer. Angeboten werden nur abgeschlossene Jahre: Wrapped 2026 gibt es ab dem 01.01.2027 (`WrappedService.isAvailable`).

- `GET /wrapped` (`wrapped-years.html`) listet alle vergangenen Jahre mit Bestellungen als Karten, neuestes zuerst, je mit Bestellungen, insgesamt gezahlt, beliebtestem Gericht und den eigenen Bestellungen und Ausgaben (`WrappedService.getYearSummaries`). Ein Klick startet die Story des Jahres. Gibt es noch kein abgeschlossenes Jahr mit Bestellungen, kündigt eine Karte das laufende Jahr für den 1. Januar an. Das × führt zum Dashboard.
- `GET /wrapped?year=2025` (`wrapped.html`) spielt die Story dieses Jahres. Das laufende, ein zukünftiges, ein ungültiges oder kein Jahr führt zurück zur Übersicht. Das × und die letzte Folie („All years“) führen ebenfalls zur Übersicht.

**Was zählt** (`WrappedService`): Bestellungen mit Datum im gewählten Jahr im Status CLOSED oder ARCHIVED (die Beträge stehen fest) und mit mindestens einem Teilnehmer nach `OrderService.isParticipant`. Offene und bestellte Bestellungen zählen erst nach dem Schließen; Bestellungen ohne Standort zählen nur in der Gesamtfolie.

**Pro Standort (Kassel, Frankfurt) und gesamt:**

| Kennzahl | Berechnung |
|----------|------------|
| Bestellungen | Anzahl der gezählten Bestellungen |
| Gerichte | Summe aller Artikelmengen (Cost splits haben keine Artikel) |
| Insgesamt gezahlt | Artikelsumme + Trinkgeld der Artikelbestellungen, plus `splitTotal` der Cost splits |
| Trinkgeld gesamt | Summe `tipAmount` der Artikelbestellungen |
| Ø Trinkgeld pro Bestellung | Trinkgeld gesamt ÷ Anzahl Artikelbestellungen (auch die ohne Trinkgeld), dazu der Anteil am Artikelwert in Prozent |
| Personen | Anzahl verschiedener Teilnehmer |
| Beliebteste Gerichte | Top 3 nach Menge. Artikel mit gleichem Namen (ohne Beachtung der Groß-/Kleinschreibung) werden über Menülisten hinweg zusammengezählt; dazu das Restaurant, aus dem das Gericht am häufigsten kam |
| Lieblingsrestaurant, stärkster Wochentag | nach Anzahl Bestellungen (`placeName` bzw. `orderDate`) |
| Größte Runde | Bestellung mit den meisten Teilnehmern |

Haben mindestens zwei Standorte Bestellungen, vergleicht eine Folie sie direkt (Bestellungen, Gerichte, insgesamt gezahlt, Ø Trinkgeld, Personen); der höchste Wert bekommt eine Krone.

**Persönlich** (angemeldeter Nutzer):

| Kennzahl | Berechnung |
|----------|------------|
| Ausgegeben | je Teilnahme eigene Artikel + `getPerPersonCharge` (Trinkgeld- bzw. Kostenanteil), bezahlt oder nicht |
| Bestellungen, Ø pro Bestellung, Gerichte, Cost splits | aus den eigenen Teilnahmen |
| Top-Gerichte | Top 3 nach Menge, zusammengefasst wie oben |
| Erste / letzte Bestellung | Datum und Restaurant |
| Lieblingstag, hungrigster Monat, Lieblingsrestaurant | nach Anzahl eigener Bestellungen |
| Größte Bestellung | höchster eigener Betrag einer Bestellung |
| Trinkgeldanteil | Summe der eigenen Trinkgeldanteile |
| Organisiert | gezählte Bestellungen, die der Nutzer angelegt hat |
| Geld ausgelegt | gezählte Bestellungen, deren Empfänger der Nutzer ist (`paidByName`, sonst der Ersteller – wie bei den offenen Beträgen), mit Gesamtbetrag |
| Platzierung | Platz nach Anzahl Bestellungen unter allen, die im Jahr bestellt haben (gleiche Anzahl = gleicher Platz); nur angezeigt für die Top 3 oder die obere Hälfte |

Bei Gleichstand gewinnt der Eintrag, der im Jahr zuerst vorkam. Der Standort, an dem der Nutzer am häufigsten bestellt hat, kommt zuerst. Wer im Jahr an keiner Bestellung teilgenommen hat, sieht statt der persönlichen Folien eine Hinweisfolie.

**Hinweis im Januar:** Den ganzen Januar über zeigt jede Seite mit angemeldetem Nutzer (Übersicht `/` und alle Unterseiten, nicht `/wrapped` selbst und nicht die öffentliche `/version`) unten rechts einen kleinen Hinweis „🎁 Your 2026 Wrapped“ mit Link direkt auf die Story des Vorjahres (`/wrapped?year=2026`). Dafür legt `WrappedHintAdvice` (`@ControllerAdvice`) `wrappedYear` (das Vorjahr) in jedes Model, sofern dieses Jahr Bestellungen hat; außerhalb des Januars oder ohne Bestellungen ist es `null`. Das Fragment `fragments/theme.html` rendert den Hinweis dann als `<template>` im `<head>`, `static/js/wrapped-hint.js` setzt ihn in den `<body>`. Das × verkleinert ihn auf das Geschenk-Symbol; das merkt sich der Browser pro Jahr in `localStorage` (`yy-wrapped-hint-min`). Außerhalb des Januars ist `/wrapped` weiter erreichbar, wird aber nirgends verlinkt.

**Vorschau zum Testen:** `/wrapped?preview=on` lässt die Wrapped-Regeln für die eigene Browser-Sitzung so tun, als wäre schon der 1. Januar des nächsten Jahres (`WrappedPreview`). Das laufende Jahr erscheint dann in der Übersicht und als Story (mit den Bestellungen bis heute, gekennzeichnet mit „Preview · orders so far“), und der Januar-Hinweis erscheint auf allen Seiten. Die Übersicht zeigt einen Vorschau-Hinweis mit „End preview“ (`/wrapped?preview=off`); sonst endet die Vorschau mit der Sitzung. Andere Nutzer sind nicht betroffen. Der Parameter übersteht die Namenseingabe.

**Release Notes:** Dort ist das Feature bewusst nur als „A secret statistics feature“ ohne Details erwähnt.

**Darstellung:** `wrapped.html` rendert jede Folie als `<section class="wr-slide">`. `static/js/wrapped.js` macht daraus eine Story: rechts tippen, Pfeil rechts, Leertaste oder nach links wischen geht weiter; das linke Drittel, Pfeil links oder nach rechts wischen geht zurück. Oben zeigen Balken den Fortschritt, die Foliennummer steht im URL-Hash (Neuladen bleibt auf der Folie), große Zahlen zählen beim Erscheinen hoch (nicht bei `prefers-reduced-motion`). Ohne JavaScript stehen die Folien untereinander. Styles: `static/css/wrapped.css`.

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
java -DYATTA_YAM_YAM_PASSWORD=deinPasswort -jar target/yatta-yam-yam-1.12.0.jar
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
    │   │   ├── WebConfig.java                # Web-Konfiguration (z. B. statische Ressourcen)
    │   │   ├── WrappedHintAdvice.java        # wrappedYear im Januar für den Wrapped-Hinweis
    │   │   └── WrappedPreview.java           # Wrapped-Vorschau zum Testen (?preview=on, pro Sitzung)
    │   ├── controller/
    │   │   ├── ContactController.java        # Kontaktbuch: Liste, Anlegen, Bearbeiten, Löschen
    │   │   ├── LoginController.java          # Cookie-Login, Nutzer-Flow, /users, /version
    │   │   ├── OrderController.java          # Bestellungen, Auswahl, Zahlungen, Artikelverwaltung
    │   │   └── WrappedController.java        # Jahresrückblick /wrapped
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
    │       ├── OrderService.java             # Bestelllogik, Kostenberechnung, Zahlungen
    │       ├── PaymentCalculatorService.java # Daten für den Zahlungsrechner (nur lesend)
    │       └── WrappedService.java           # Zahlen für den Jahresrückblick
    └── resources/
        ├── application.properties
        ├── static/
        │   ├── css/
        │   │   ├── christmas.css             # Weihnachts-Look (ohne Wirkung außerhalb der Saison)
        │   │   ├── dashboard.css
        │   │   ├── easter.css                # Oster-Look (ohne Wirkung außerhalb der Saison)
        │   │   ├── garlic.css                # Knoblauch-Look (ohne Wirkung außerhalb der zwei Tage)
        │   │   ├── gta.css                   # GTA-VI-Hommage (nur per Link, ohne Saison)
        │   │   ├── halloween.css             # Halloween-Look (ohne Wirkung außerhalb der Saison)
        │   │   ├── mario.css                 # Super-Mario-Hommage (MAR10-Tag, 10. März)
        │   │   ├── muertos.css               # Día-de-los-Muertos-Look (ohne Wirkung außerhalb der Saison)
        │   │   ├── pasta.css                 # Pasta-Look (nur per Link, ohne Saison)
        │   │   ├── pelmeni.css               # Pelmeni-Look (nur per Link, ohne Saison)
        │   │   ├── pokemon.css               # Pokémon-Hommage (nur per Link, ohne Saison)
        │   │   ├── pizza.css                 # Pizza-Look (ohne Wirkung außerhalb der Pizza-Woche)
        │   │   ├── style.css                 # Basis-Styles + Farb-Tokens (--yy-*) für hell/dunkel
        │   │   ├── symbolics.css             # Easter Egg: Symbolics-Modus (ohne Wirkung, solange aus)
        │   │   ├── visitors.css              # Besucher: Bühne und Animationen
        │   │   └── wrapped.css               # Folien des Jahresrückblicks
        │   ├── images/
        │   │   ├── favicon.svg
        │   │   └── logo.png
        │   └── js/
        │       ├── christmas.js              # Weihnachts-Besucher: Weihnachtsmann und Rentiere
        │       ├── easter.js                 # Oster-Besucher: Osterhase und Küken
        │       ├── garlic.js                 # Knoblauch-Besucher: Knolle, Fledermaus, Vampir
        │       ├── gta.js                    # GTA-Besucher: Verfolgungsjagd, Hubschrauber, Speedboot, Flamingo, Geldsack
        │       ├── halloween.js              # Halloween-Besucher: Hexe, Skelett, Gespenst, Spinne, Katze
        │       ├── mario.js                  # Mario-Besucher: Pixel-Koch, Brokkoli, Vogel mit Pizza, Ziegelblock
        │       ├── muertos.js                # Día-de-los-Muertos-Besucher: Monarchfalter, Catrina, Skelett mit Gitarre
        │       ├── pasta.js                  # Pasta-Besucher: Farfalle, Fleischbällchen, Nudel-Parade
        │       ├── payment-calculator.js     # Zahlungsrechner auf dem Dashboard: Filter, Abwahl, Summen
        │       ├── pelmeni.js                # Pelmeni-Besucher: Löffel-Surfer, Teigtaschen-Parade, Gabel
        │       ├── pokemon.js                # Pokémon-Besucher: erfundene Pixel-Essensmonster, Grillhähnchen, Spielmodul
        │       ├── pizza.js                  # Pizza-Besucher: fliegende Pizza, Pizzastück, Pizzabäcker
        │       ├── theme-info.js             # (i)-Knopf in der Menüleiste mit Infos zum aktiven Look
        │       ├── theme.js                  # Hell/dunkel nach Systemeinstellung, Saison-Looks, Symbolics-Easter-Egg
        │       ├── visitors.js               # Besucher: Zeitplan, Bewegungen, Rufwort
        │       ├── wrapped-hint.js           # Januar: Hinweis auf den Jahresrückblick unten rechts
        │       └── wrapped.js                # Story-Navigation des Jahresrückblicks
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
            ├── themes.html                   # Versteckte Seite: alle Looks mit Vorschau-Links
            ├── users.html                    # Nutzerstatistiken
            ├── version.html                  # Versionsinfo
            ├── wrapped.html                  # Jahresrückblick „Wrapped“ (Story-Folien eines Jahres)
            ├── wrapped-years.html            # Wrapped: Übersicht aller vergangenen Jahre
            └── fragments/
                ├── open-debt-badge.html      # Rotes Badge mit offenem Betrag neben dem Namen
                ├── payment-calculator.html   # Pop-up „Payment calculator“ auf dem Dashboard
                └── theme.html                # Einbindung im <head>: Theme-Skripte und -Styles, im Januar der Wrapped-Hinweis
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
- Ausnahme: Die Folien von `/wrapped` (`wrapped.css`, Variablen `--wr-*`) behalten in hell und dunkel bewusst ihre eigenen kräftigen Farben (weiße Schrift auf gesättigtem Verlauf); nur die Seite drumherum folgt dem Theme.

### Saisonale Looks: Feste und Aktionstage

Zu sieben Zeiten im Jahr zieht sich die App von selbst um. `theme.js` prüft dafür beim Laden jeder Seite das lokale Datum des Browsers und setzt `data-yy-theme` auf `<html>` (`pizza`, `mario`, `easter`, `garlic`, `halloween`, `muertos`, `christmas`); kein Server-Code, keine Konfiguration. Alle Looks folgen weiter der Hell/Dunkel-Einstellung des Systems und haben je eine eigene helle und dunkle Palette.

**Pizza** – die Woche um den Tag der Pizza (9. Februar): vom 6. bis einschließlich 12. Februar. Tomatenrote Menüleiste mit einer rot-weiß gestreiften Pizzeria-Markise, basilikumgrüne Buttons, jeder Avatar wird zur Pizza (die Initiale liegt auf dem Mozzarella), herabfallende Beläge (Salami, Basilikum, Oliven, Pilze, Tomaten) hinter den Inhalten, eine rot-weiß karierte Tischdecke mit Pizza, Olivenöl, Basilikum und Streuern am unteren Rand (44 px Abstand unten), ein 🍕 neben dem App-Namen; Paletten „Trattoria“ / „Holzofen-Nacht“. Styles: `static/css/pizza.css`.

**Super-Mario-Hommage** („Lunch World 1-1“) – nur am MAR10-Tag (10. März, abgekürzt geschrieben „MAR10“), von 0:00 bis 23:59 Uhr. Eine Verbeugung vor den 8-Bit-Jump-'n'-Runs, als eigene Pixel-Grafik – keine Figuren, Gegner, Gegenstände, Logos, Musik oder Levelgrafiken aus den Spielen (kein Klempner, keine Pilze, Schildkröten, „?“-Blöcke oder Röhren). Menüleiste als Ziegelmauer mit sich drehenden Münzen darunter, rote Buttons, jeder Avatar wird zur großen Pixel-Münze mit der Initiale, herabfallende Münzen und Ziegelbrocken, Bodenblöcke mit Büschen und Münzen am unteren Rand (48 px Abstand unten), ein 🕹️ neben dem App-Namen. Hell ist „über der Erde“ (braune Ziegel, heller Himmel), dunkel „unter der Erde“ (blaue Ziegel). Das (i)-Fenster enthält eine Hommage aus Sicht eines Kindes der NES-Zeit; der Hinweis im Symbolics-Modus nennt den Anlass „MAR10 Day“ (`occasion` in `theme-info.js`). Fällt der 10. März in die Osterwochen (nur bei Ostersonntag am 22. oder 23. März, zuletzt 2008), hat Mario an diesem Tag Vorrang. Styles: `static/css/mario.css`.

**Ostern** – vom Montag zwei Wochen vor Ostersonntag (dem Montag vor Palmsonntag), 0:00 Uhr, bis einschließlich Ostermontag (ab dem Dienstag danach, 0:00 Uhr, wieder aus). Der Ostersonntag wird mit der Gaußschen Osterformel (gregorianisch) berechnet; 2027 läuft der Look also vom 15. bis 29. März. Himmelblaue Menüleiste mit einer Schnur bemalter Ostereier, die leicht schaukeln, rosa Buttons und Avatare, Hasenohren auf allen Avataren, langsam herabschwebende Blütenblätter hinter den Inhalten, eine Wiese mit versteckten Eiern und Blumen am unteren Rand (jede Seite bekommt dafür 40 px Abstand unten), ein 🐣 neben dem App-Namen; Paletten „Frühlingsmorgen“ / „Frühlingsnacht“. Styles: `static/css/easter.css`.

**Knoblauch** – nur am Knoblauch-Tag (19. April) und am Tag der Knoblauch-Fans (6. Oktober), jeweils von 0:00 bis 23:59 Uhr. Olivgrüne Menüleiste mit einem schaukelnden Knoblauchzopf, knoblauchviolette Buttons, jeder Avatar wird zur Knoblauchknolle (die Initiale in der Mitte), herabfallende Knoblauchzehen hinter den Inhalten, ein Knoblauchbeet mit aufsteigendem Duft am unteren Rand (46 px Abstand unten), ein 🧄 neben dem App-Namen; Paletten „Küche“ / „Gartennacht“. Styles: `static/css/garlic.css`. Fällt der 19. April in die Osterwochen (z. B. 2025, oder 2030 auf Karfreitag), hat Knoblauch an diesem einen Tag Vorrang.

**Halloween** – vom 18. Oktober, 0:00 Uhr, bis einschließlich 31. Oktober (ab dem 1. November, 0:00 Uhr, wieder aus). Nachtviolette Menüleiste mit einer Kette flackernder Kürbislaternen, orange Buttons, jeder Avatar wird zum Totenkopf (Augenhöhlen über der Initiale, Zahnreihe darunter – die Initiale bleibt lesbar), langsam herabfallendes Herbstlaub hinter den Inhalten, ein Friedhof mit Grabsteinen, Zaun und Kürbissen am unteren Rand (jede Seite bekommt dafür 44 px Abstand unten), ein 🎃 neben dem App-Namen; Paletten „neblige Dämmerung“ / „Geisternacht“. Styles: `static/css/halloween.css`.

**Día de los Muertos** (mexikanisches Totenfest) – in der ersten Novemberwoche (1. bis 7. November), direkt nach Halloween (ab dem 8. November, 0:00 Uhr, wieder aus). Menüleiste in Rosa mexicano bis Violett mit einer flatternden Girlande aus Papel picado (Scherenschnitt-Fähnchen mit Blüten, Rauten und Schädeln), pinke Buttons, jeder Avatar wird zum Zuckerschädel (Calavera: Augen mit Blütenkränzen, Ringelblume auf der Stirn, genähtes Lächeln – die Initiale bleibt in der Mitte lesbar), herabschwebende Cempasúchil-Blüten (Studentenblumen) hinter den Inhalten, eine Ofrenda mit flackernden Kerzen, Blüten und kleinen Zuckerschädeln am unteren Rand (jede Seite bekommt dafür 50 px Abstand unten), ein 🌼 neben dem App-Namen; Paletten „warmer Tag“ / „Kerzennacht“. Styles: `static/css/muertos.css`.

**Weihnachten** – vom Montag nach Totensonntag, 0:00 Uhr, bis einschließlich 26. Dezember (ab dem 27. Dezember, 0:00 Uhr, wieder aus). Totensonntag ist der letzte Sonntag vor dem 1. Advent, also immer zwischen dem 20. und 26. November (2026: Start am 23. November). Tannengrüne Menüleiste mit funkelnder Lichterkette (auf Seiten ohne Menüleiste am oberen Rand), rote Buttons und Avatare, Nikolausmützen auf allen Avataren, leise fallender Schnee hinter den Inhalten, ein 🎄 neben dem App-Namen; Paletten „verschneiter Tag“ / „Winternacht“. Styles: `static/css/christmas.css`.

**Nur per Link** – Looks ohne Saison, zum gezielten Verteilen an bestimmten Tagen (Liste `LINK_ONLY` in `theme.js`). Sie gelten wie jede Vorschau nur in diesem Browser-Tab, bis er geschlossen wird, und das Datum schaltet sie nie ein. Ihr (i)-Fenster zeigt nur Titel, Ankündigung und Tipp (`when: null`, `previewNote: false` in `theme-info.js`).

**Pelmeni** („Triple-T (Teig-Taschen-Tag)“, `?theme=pelmeni`): Gzhel-blaue Menüleiste mit weißer Spitzenborte, rote-Bete-farbene Buttons, jeder Avatar wird zum blau-weißen Teller mit Pelmeni (die Initiale liegt auf einem Klecks Smetana), herabfallende Pelmeni, Dill und Pfefferkörner hinter den Inhalten, ein Nudelbrett mit Mehl, Teigkreisen, Nudelholz und einer Schüssel Pelmeni am unteren Rand (46 px Abstand unten), ein 🥟 neben dem App-Namen; Paletten „Mehlküche“ / „Sibirische Nacht“. Styles: `static/css/pelmeni.css`.

**Pasta** („Pasta Day“, `?theme=pasta`): Menüleiste in Amalfi-Petrol mit Tagliatelle, die an einer Holzstange trocknen, tomatenrote Buttons, jeder Avatar wird zum Teller Spaghetti (die Initiale liegt auf einer Burrata), herabfallende Farfalle, Penne, Fusilli, Muschelnudeln, Basilikum und Parmesan, eine blau-weiß gestreifte Tischdecke mit Spaghettitopf, Sieb, einem Glas Penne, Parmesan und einem Teller am unteren Rand (46 px Abstand unten), ein 🍝 neben dem App-Namen; Paletten „Zitronenküche“ / „Trattoria-Nacht“. Styles: `static/css/pasta.css`.

**GTA-VI-Hommage** („Food Order in Vice City“, `?theme=gta`): eigene Zeichnungen im Miami-Neon-Stil, keine Inhalte aus dem Spiel (keine Logos, Figuren, Schriften oder Grafiken von Rockstar). Menüleiste von Nachtviolett zu Neonpink mit flackernden Neonröhren an der Unterkante, pinke Buttons, jeder Avatar wird zur gestreiften Synthwave-Sonne (die Initiale darauf), herabfallende Dollarscheine und Palmwedel, eine Ocean-Drive-Skyline mit Art-déco-Hotels, Palmen und Meer am unteren Rand (52 px Abstand unten, nachts mit Neonrand), ein 🌴 neben dem App-Namen; Paletten „Sonnenuntergang“ / „Neonnacht“. Das (i)-Fenster enthält eine Hommage aus Sicht eines Fans, der seit GTA V (2013) gewartet hat. Styles: `static/css/gta.css`.

**Pokémon-Hommage** („A Wild Lunch Appeared!“, `?theme=pokemon`): eine Verbeugung vor den 151 und der Roten, Blauen und Gelben Edition für den Game Boy, als eigene Pixel-Grafik – keine Pokémon, kein Poké Ball, keine Logos, Sprites, Musik oder Slogans aus den Spielen. Die vier Grüntöne des alten Handheld-Bildschirms (Pixel scharf gerendert), dunkelgrüne Menüleiste mit roten, blauen und gelben Spielmodulen an einem Link-Kabel, Buttons in der Farbe der A/B-Knöpfe, jeder Avatar wird zum kleinen grünen Handheld-Bildschirm mit der Initiale, herabfallende Pixel-Herzen, -Sterne, -Noten und -Blätter, hohes Pixel-Gras mit Blumen in den drei Editionsfarben am unteren Rand (40 px Abstand unten), ein 🎮 neben dem App-Namen; Paletten „Schulbusfenster“ / „unter der Bettdecke mit Taschenlampe“. Das (i)-Fenster enthält eine Hommage aus Sicht eines 90er-Kindes. Styles: `static/css/pokemon.css`.

**Übersicht `/themes`:** Eine versteckte Seite (nirgends verlinkt, nur nach Login) listet alle Looks als Karten: Saison-Looks in der Reihenfolge, in der sie als Nächstes kommen, mit Regel, aktuellem bzw. nächstem Zeitraum (aus `theme.js` berechnet), Zahl der Besucher und Rufwort; danach die Link-Looks, Symbolics und der Standard-Look. Jede Karte hat einen Knopf, der das Dashboard mit `?theme=…` in einem neuen Tab öffnet, und den Link zum Kopieren. Die Karten entstehen im Browser aus `window.yyTheme` (`theme.js`), `window.yyThemeInfo` (`theme-info.js`) und `yyVisitors.castOf()` (`visitors.js`) – ein neuer Look erscheint dort also von selbst.

- **Vorschau per Link:** `?theme=pizza`, `?theme=mario`, `?theme=easter`, `?theme=garlic`, `?theme=halloween`, `?theme=muertos` bzw. `?theme=christmas` (und die Link-Looks `?theme=pelmeni`, `?theme=pasta`, `?theme=gta`, `?theme=pokemon`) an die URL einer beliebigen Seite hängen (z. B. `/orders/dashboard?theme=pizza`, bzw. `&theme=pizza`). Der Parameter übersteht beide Login-Schritte und wird danach aus der Adressleiste entfernt. Die Vorschau gilt nur für diesen Browser-Tab, bis er geschlossen wird (`sessionStorage`, `yy-theme-preview` = Name des Looks) – eine vergessene Vorschau bleibt also nicht über den Anlass hinaus hängen. `?theme=default` beendet sie vorher.
- **Info-Knopf:** Solange ein besonderer Look aktiv ist (auch der Symbolics-Modus), steht in der Menüleiste ganz vorne in der rechten Gruppe ein (i)-Knopf. Er öffnet ein Bootstrap-Modal mit dem Anlass in ein paar Sätzen, dem Zeitraum, einem Hinweis auf die Besucher samt Rufwort und – bei einer Vorschau – dem Hinweis, wie sie endet. `static/js/theme-info.js` setzt den Knopf per Skript in jede Seite mit Menüleiste (Formularseiten, deren Leiste nur den App-Namen zeigt, bekommen rechts eine eigene Gruppe) und blendet ihn ein, aus oder um, sobald sich `data-yy-theme` ändert. Die Texte stehen in `INFO` in derselben Datei; Seiten ohne Menüleiste (Login, Namenseingabe, Startseite, Release Notes) haben keinen Knopf.
- **Hinweis im Symbolics-Modus:** Symbolics verdeckt die Saison-Looks. Damit auch diese Nutzer sie mitbekommen, erscheint auf jeder Seite unten rechts (über der Kommandozeile) ein Fenster „Incoming message“, solange Symbolics an ist und das Datum einen Saison-Look vorsieht – mit dem Anlass und dem Knopf „Switch to the standard look“. Der schaltet Symbolics an Ort und Stelle ab (ohne Neuladen, Eingaben bleiben erhalten; ohne JavaScript führt der Link auf `?theme=default`), danach ist der Saison-Look zu sehen; `symbolics` tippen bringt den Modus zurück. „Not now“ (×) blendet den Hinweis für den Rest dieses Anlasses aus (`localStorage`, `yy-season-hint-dismissed` = z. B. `christmas:2026`, bei Knoblauch mit Monat, weil er zweimal im Jahr kommt); beim nächsten Anlass erscheint er wieder. Derselbe Weg zurück steht im (i)-Fenster des Symbolics-Modus. Umgesetzt in `theme-info.js` (über `window.yyTheme` aus `theme.js`), Styles in `symbolics.css`.
- **Vorrang:** Vorschau in diesem Tab › eingeschalteter Symbolics-Modus › Look des Tages (einzelne Aktionstage vor mehrwöchigen Festen) › normaler Look. Wer Symbolics an hat, behält es also auch in der Saison; Ausschalten (`symbolics` tippen oder `?theme=default`) führt zum Look des Tages zurück. Einen Schalter, um einen Look abzuwählen, gibt es nicht.
- Bei „Bewegung reduzieren“ im Betriebssystem (`prefers-reduced-motion`) fällt und schwebt nichts, Girlanden, Kerzen und Lichter stehen still und es kommen keine Besucher.
- Alle Regeln sind auf `html[data-yy-theme="…"]` des jeweiligen Looks beschränkt, die Dateien wirken also sonst nicht. Alle Bilder (Hüte, Ohren, Masken, Girlanden, Herabfallendes, Ränder unten) sind Inline-SVGs in CSS-Variablen (keine zusätzlichen Requests). Das Herabfallende liegt mit `z-index: -1` hinter allen Karten; nichts davon fängt Klicks ab.

### Besucher

Während eines Looks kommt alle 1–5 Minuten (zufällig) ein Besucher über den Bildschirm, nie zweimal derselbe hintereinander. Der Auftritt in der Spalte „Fliegt“ kommt doppelt so häufig wie die anderen (bei Knoblauch der tanzende Knoblauch, bei GTA die Verfolgungsjagd, bei Mario der springende Koch).

| Look (Skript) | Fliegt durch die obere Hälfte | Am unteren Rand entlang | Lässt sich von oben herab | Schaut vom Rand herein und winkt | Rufwort |
|---|---|---|---|---|---|
| Pizza (`pizza.js`) | Pizza dreht sich wie eine Frisbee | Pizzastück tanzt; Pizzabäcker wirft Teig | Pizzastück an einem Käsefaden | Pizzastück | `pizza` |
| Super-Mario-Hommage (`mario.js`) | Vogel mit einem Stück Pizza im Schnabel | springender Pixel-Koch mit zwei Münzen (doppelt so häufig); grimmiger Brokkoli | Ziegelblock an der Kette, aus dem eine Münze springt | Pixel-Koch | `mario` |
| Ostern (`easter.js`) | Osterhase im Ei-Heißluftballon | Osterhase hoppelt mit Körbchen; Küken tanzt | – | Osterhase oder Küken im Ei | `hoppel` |
| Knoblauch (`garlic.js`) | Fledermaus auf der Flucht | Knoblauchknolle tanzt | Knoblauch an der Schnur | Vampir („Ugh, garlic!“) oder Knoblauchknolle | `knoblauch` |
| Halloween (`halloween.js`) | Hexe auf dem Besen mit schwarzer Katze | Skelett mit Fliege tanzt; Gespenst schwebt | Spinne | schwarze Katze oder Gespenst („Boo!“) | `spuk` |
| Día de los Muertos (`muertos.js`) | Schwarm Monarchfalter | Catrina tanzt; Skelett mit Blumenkranz spielt Gitarre | – | Skelett im bestickten Hemd oder die Catrina | `calavera` |
| Weihnachten (`christmas.js`) | Weihnachtsmann im Schlitten mit zwei Rentieren | Weihnachtsmann oder Rentier tanzt | – | Weihnachtsmann oder Rentier | `hohoho` |
| Pelmeni, nur per Link (`pelmeni.js`) | Pelmen surft auf einem Holzlöffel | Parade aus Gyoza, Ravioli und Pelmen; Pelmen mit Dillfrisur tanzt | Gabel mit aufgespießtem Pelmen | Pelmen mit Smetana-Häubchen | `pelmeni` |
| GTA-VI-Hommage, nur per Link (`gta.js`) | Hubschrauber mit Suchscheinwerfer | Verfolgungsjagd Sportwagen und Polizeiauto (doppelt so häufig); Speedboot | Geldsack am Seil | Flamingo mit Sonnenbrille | `vicecity` |
| Pokémon-Hommage, nur per Link (`pokemon.js`) | Donut mit Flügeln | wilder BURGLIN mit Textbox „A wild BURGLIN appeared!“; tanzender Taco; hüpfendes, dampfendes Grillhähnchen („A wild BROILER appeared!“, goldbraun wie mit dem Super Game Boy eingefärbt) | Spielmodul (rot, blau oder gelb) am Link-Kabel | Reisbällchen | `pokemon` |
| Pasta, nur per Link (`pasta.js`) | Schwarm Farfalle | Fleischbällchen mit Spaghetti-Haaren tanzt; Parade aus Penne, Fusilli und Muschelnudel | Fleischbällchen an einem Spaghetti | Fleischbällchen | `pasta` |

- Zeitplan, Bewegungen und Rufwort steuert `static/js/visitors.js`; die Skripte der Looks (`static/js/*.js` aus der Tabelle) zeichnen nur die Figuren und melden sie mit `yyVisitors.add(...)` an (alle laden mit `defer`, `visitors.js` zuerst).
- Das Rufwort tippt man außerhalb eines Formularfelds; es ruft sofort einen Besucher, aber nur während des passenden Looks.
- Der nächste Termin steht in `sessionStorage` (`yy-visitor-next`), damit der Rhythmus über Seitenwechsel hinweg weiterläuft statt bei jedem Klick neu zu starten; ist er beim Laden einer Seite schon fällig, kommt der Besuch 3 Sekunden später. Fällt er in eine Zeit, in der der Tab im Hintergrund ist, kommt er 3 Sekunden nach der Rückkehr. Beim ersten Aufruf einer Vorschau (`?theme=…`) erscheint der erste Besucher schon nach 3 Sekunden.
- Die Figuren sind Inline-SVGs, fangen keine Klicks ab (`pointer-events: none`) und werden danach wieder entfernt. Bewegung über die Web Animations API, Arme, Beine, Ohren und Flügel per CSS (`.yy-v-*` in `static/css/visitors.css`); der Faden beim Herablassen ist `.yy-visitor-drop::before` (Farbe und Stärke pro Besucher).

### Easter Egg: Symbolics-Modus

Ein versteckter dritter Look im Stil von symbolics.com, der ersten jemals registrierten .com-Domain: Neon-Retro-Terminal mit Scanlines auf Schwarz, leuchtenden cyanfarbenen Überschriften und Rahmen, grüner Monospace-Schrift, Magenta- und Gelb-Akzenten, Fenstertiteln mit drei Punkten und einer Kommandozeile am unteren Rand (`C:\YATTA-YAM-YAM\ORDERS\DASHBOARD>`), die anzeigt, welchen Befehl ein Klick auf das Element unter dem Mauszeiger ausführen würde.

- **Ein/aus:** irgendwo außerhalb eines Formularfelds `symbolics` tippen oder auf `/version` 7-mal hintereinander auf das Versions-Badge tippen (funktioniert auch auf dem Handy).
- **Per Link:** `?theme=symbolics` an die URL einer beliebigen Seite hängen (z. B. `/orders/12?theme=symbolics`, bzw. `&theme=symbolics`, wenn die URL schon Parameter hat); `?theme=default` schaltet zurück (und beendet auch eine Saison-Vorschau). Der Parameter übersteht beide Login-Schritte. Sobald die Wahl gespeichert ist, entfernt `theme.js` ihn aus der Adressleiste, damit Neuladen oder Kopieren der URL nicht erneut umschaltet.
- Die Wahl wird pro Browser in `localStorage` gespeichert (`yy-theme` = `symbolics`); andere offene Tabs ziehen mit. Ist der Speicher blockiert, gilt der Modus nur für die aktuelle Seite.
- Styles: `static/css/symbolics.css`. Alle Regeln sind auf `html[data-yy-theme="symbolics"]` beschränkt, die Datei wirkt also sonst nicht. In diesem Modus ist `data-bs-theme` unabhängig von der Systemeinstellung immer `dark`.
- Bewusst nicht in den Release Notes erwähnt.
