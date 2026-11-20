package com.nameapp.controller;

import com.nameapp.model.AppUser;
import com.nameapp.service.AppUserService;
import com.nameapp.service.WrappedService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

/**
 * Year-end review: /wrapped shows the past year, /wrapped?year=2024 an earlier one.
 * The running year is never shown (Wrapped 2026 only from 1 January 2027 on); such
 * a year, or an invalid one, falls back to the past year.
 */
@Controller
public class WrappedController {

    private static final int FIRST_YEAR = 2000;

    private final WrappedService wrappedService;
    private final AppUserService userService;

    public WrappedController(WrappedService wrappedService, AppUserService userService) {
        this.wrappedService = wrappedService;
        this.userService = userService;
    }

    @GetMapping("/wrapped")
    public String wrapped(@RequestParam(required = false) Integer year,
                          HttpServletRequest request, Model model) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return redirectToHome(request);

        LocalDate today = LocalDate.now();
        int shownYear = year != null && year >= FIRST_YEAR && WrappedService.isAvailable(year, today)
                ? year
                : WrappedService.defaultYear(today);

        model.addAttribute("user", user.get());
        model.addAttribute("wrapped", wrappedService.build(shownYear, user.get()));
        model.addAttribute("years", wrappedService.getYearsWithOrders(today));
        // The UI is English: weekday and month names in dates, too
        model.addAttribute("en", Locale.ENGLISH);
        return "wrapped";
    }

    // ── Helpers (same as in the other controllers) ────────────────────────────

    private String redirectToHome(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String query = request.getQueryString();
        request.getSession().setAttribute("redirectAfterLogin",
                query != null ? uri + "?" + query : uri);
        return "redirect:/";
    }

    private Optional<AppUser> currentUser(HttpServletRequest request) {
        if (request.getCookies() == null) return Optional.empty();
        return Arrays.stream(request.getCookies())
                .filter(c -> "nameapp_user".equals(c.getName()))
                .map(c -> {
                    try {
                        String name = URLDecoder.decode(c.getValue(), StandardCharsets.UTF_8);
                        return userService.findByName(name).orElse(null);
                    } catch (Exception e) { return null; }
                })
                .filter(Objects::nonNull)
                .findFirst();
    }
}
