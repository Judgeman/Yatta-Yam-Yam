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
 * Year-end review. /wrapped lists all past years with orders; /wrapped?year=2025
 * plays that year's story. Only completed years are offered (Wrapped 2026 from
 * 1 January 2027 on); the running, a future or an invalid year leads back to the list.
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
    public String wrapped(@RequestParam(name = "year", required = false) String yearParam,
                          HttpServletRequest request, Model model) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return redirectToHome(request);

        LocalDate today = LocalDate.now();
        model.addAttribute("user", user.get());
        // No January hint on the Wrapped pages themselves (see fragments/theme.html)
        model.addAttribute("hideWrappedHint", true);

        if (yearParam == null || yearParam.isBlank()) {
            model.addAttribute("summaries", wrappedService.getYearSummaries(user.get(), today));
            // Shown while there is no past year yet: the running year comes next
            model.addAttribute("nextYear", today.getYear());
            return "wrapped-years";
        }
        int year;
        try {
            year = Integer.parseInt(yearParam.trim());
        } catch (NumberFormatException e) {
            return "redirect:/wrapped";
        }
        if (year < FIRST_YEAR || !WrappedService.isAvailable(year, today)) {
            return "redirect:/wrapped";
        }

        model.addAttribute("wrapped", wrappedService.build(year, user.get()));
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
