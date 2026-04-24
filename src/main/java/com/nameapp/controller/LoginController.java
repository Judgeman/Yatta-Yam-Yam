package com.nameapp.controller;

import com.nameapp.model.AppUser;
import com.nameapp.service.AppUserService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Controller
public class LoginController {

    private static final String COOKIE_NAME = "nameapp_user";
    private static final int COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

    private final AppUserService userService;

    public LoginController(AppUserService userService) {
        this.userService = userService;
    }

    // ─── Home: auto-login from cookie or show name input ───────────────────────

    @GetMapping("/")
    public String home(HttpServletRequest request, Model model) {
        String savedName = getCookieValue(request);
        if (savedName != null) {
            Optional<AppUser> user = userService.findByName(savedName);
            if (user.isPresent()) {
                model.addAttribute("user", user.get());
                model.addAttribute("stats", userService.getStatsForUser(user.get()));
                return "welcome";
            }
        }
        return "index";
    }

    // ─── Step 1: User submits a name ────────────────────────────────────────────

    @PostMapping("/check-name")
    public String checkName(@RequestParam String name, Model model) {
        String trimmed = name.trim();
        if (trimmed.isBlank()) {
            model.addAttribute("error", "Please enter a name.");
            return "index";
        }

        Optional<AppUser> existing = userService.findByName(trimmed);
        if (existing.isPresent()) {
            // Name exists — ask the user to confirm
            model.addAttribute("name", existing.get().getName());
            return "confirm";
        } else {
            // Name is new — create account and log in
            AppUser newUser = userService.createUser(trimmed);
            model.addAttribute("name", newUser.getName());
            return "confirm-new";
        }
    }

    // ─── Step 2a: Existing user confirms it's them ──────────────────────────────

    @PostMapping("/confirm-login")
    public String confirmLogin(@RequestParam String name,
                               HttpServletResponse response,
                               Model model) {
        Optional<AppUser> user = userService.findByName(name);
        if (user.isEmpty()) {
            model.addAttribute("error", "User not found. Please try again.");
            return "index";
        }
        setLoginCookie(response, user.get().getName());
        model.addAttribute("user", user.get());
        model.addAttribute("stats", userService.getStatsForUser(user.get()));
        return "welcome";
    }

    // ─── Step 2b: Existing user says "Not me" — go back to enter another name ──

    @PostMapping("/not-me")
    public String notMe(Model model) {
        model.addAttribute("error", "Please enter a different name.");
        return "index";
    }

    // ─── Step 3: New user confirms their new account ────────────────────────────

    @PostMapping("/confirm-new-login")
    public String confirmNewLogin(@RequestParam String name,
                                  HttpServletResponse response,
                                  Model model) {
        Optional<AppUser> user = userService.findByName(name);
        if (user.isEmpty()) {
            model.addAttribute("error", "Something went wrong. Please try again.");
            return "index";
        }
        setLoginCookie(response, user.get().getName());
        model.addAttribute("user", user.get());
        model.addAttribute("stats", userService.getStatsForUser(user.get()));
        return "welcome";
    }

    // ─── Switch account: clear cookie and go back to login ──────────────────────

    @PostMapping("/switch-account")
    public String switchAccount(HttpServletResponse response) {
        clearLoginCookie(response);
        return "redirect:/";
    }

    // ─── login ──────────────────────────────────────────────────────────────────

    @GetMapping("/login")
    public String loginPage() {
        return "login";
    }

    // ─── rename ────────────────────────────────────────────────────────────────

    @PostMapping("/rename")
    public String rename(@RequestParam String newName,
                         HttpServletRequest request,
                         HttpServletResponse response,
                         Model model) {
        String currentName = getCookieValue(request);
        if (currentName == null) return "redirect:/";

        try {
            AppUser renamed = userService.renameUser(currentName, newName.trim());
            setLoginCookie(response, renamed.getName());
            model.addAttribute("user", renamed);
            model.addAttribute("stats", userService.getStatsForUser(renamed));
            return "welcome";
        } catch (IllegalArgumentException e) {
            model.addAttribute("renameError", e.getMessage());
            Optional<AppUser> user = userService.findByName(currentName);
            user.ifPresent(u -> {
                model.addAttribute("user", u);
                model.addAttribute("stats", userService.getStatsForUser(u));
            });
            return "welcome";
        }
    }

    @GetMapping("/users")
    public String userList(HttpServletRequest request, Model model) {
        String savedName = getCookieValue(request);
        if (savedName == null || userService.findByName(savedName).isEmpty())
            return "redirect:/";

        List<Map<String, Object>> userStats = userService.getAllUserStats();

        java.math.BigDecimal totalSpentAll = userStats.stream()
                .map(s -> (java.math.BigDecimal) s.get("totalSpent"))
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        java.math.BigDecimal openAmountAll = userStats.stream()
                .map(s -> (java.math.BigDecimal) s.get("openAmount"))
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        model.addAttribute("userStats", userStats);
        model.addAttribute("totalSpentAll", totalSpentAll);
        model.addAttribute("openAmountAll", openAmountAll);
        return "users";
    }

    // ─── Cookie helpers ──────────────────────────────────────────────────────────

    private String getCookieValue(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(c -> COOKIE_NAME.equals(c.getName()))
                .map(c -> URLDecoder.decode(c.getValue(), StandardCharsets.UTF_8))
                .findFirst()
                .orElse(null);
    }

    private void setLoginCookie(HttpServletResponse response, String name) {
        String encoded = URLEncoder.encode(name, StandardCharsets.UTF_8);
        Cookie cookie = new Cookie(COOKIE_NAME, encoded);
        cookie.setMaxAge(COOKIE_MAX_AGE);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        response.addCookie(cookie);
    }

    private void clearLoginCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie(COOKIE_NAME, "");
        cookie.setMaxAge(0);
        cookie.setPath("/");
        response.addCookie(cookie);
    }
}