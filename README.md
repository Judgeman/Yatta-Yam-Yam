# NameApp – Name-Based Login with Spring Boot

A lightweight web app that identifies users by name, saves the session in a browser cookie, and stores accounts in an H2 in-memory database via Hibernate.

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Backend    | Spring Boot 3.2, Spring MVC       |
| ORM        | Hibernate / Spring Data JPA       |
| Database   | H2 (in-memory)                    |
| Templates  | Thymeleaf                         |
| Frontend   | Bootstrap 5.3                     |

---

## How It Works

1. **Visit `/`** — If a name cookie exists and matches a DB account, you're auto-logged in.
2. **Enter your name** — App checks the database:
   - **Name exists** → "Is that you?" confirmation screen
     - Say **Yes** → logged in, cookie set
     - Say **No** → go back and enter a different name
   - **Name is new** → account created, confirmation shown → logged in, cookie set
3. **Welcome screen** — Greets you by name, shows your account info.
4. **Switch Account** → clears the cookie, returns to name entry.

---

## Running the App

### Prerequisites
- Java 17+
- Maven 3.6+

### Start

```bash
mvn spring-boot:run
```

Then open: [http://localhost:8080](http://localhost:8080)

### H2 Console (optional, for debugging)

[http://localhost:8080/h2-console](http://localhost:8080/h2-console)

- JDBC URL: `jdbc:h2:mem:nameappdb`
- Username: `sa`
- Password: *(empty)*

---

## Project Structure

```
src/main/java/com/nameapp/
├── NameAppApplication.java          # Entry point
├── controller/
│   └── LoginController.java         # All routes & login flow
├── model/
│   └── AppUser.java                 # User entity
├── repository/
│   └── AppUserRepository.java       # JPA repository
└── service/
    └── AppUserService.java          # Business logic

src/main/resources/
├── application.properties           # H2 + JPA config
├── templates/
│   ├── index.html                   # Name entry
│   ├── confirm.html                 # "Is that you?" screen
│   ├── confirm-new.html             # New account confirmation
│   └── welcome.html                 # Logged-in welcome
└── static/css/
    └── style.css                    # Custom styles
```

---

## Notes

- Names are **case-insensitive** and must be **unique**.
- Sessions are stored in a browser **HttpOnly cookie** (30-day expiry).
- The H2 database is **in-memory** — data resets on every app restart. To persist data, switch to a file-based H2 URL or replace with MySQL/PostgreSQL.
