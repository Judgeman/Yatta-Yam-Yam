package com.nameapp.config;

import com.nameapp.service.WrappedService;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

import java.time.LocalDate;

/**
 * In January every page gets "wrappedYear" (the past year), provided that year has
 * orders. fragments/theme.html then adds a small hint at the bottom right of every
 * page with a logged-in user, linking to that year's review. Otherwise the attribute
 * is null and there is no hint; /wrapped itself stays reachable for past years.
 */
@ControllerAdvice
public class WrappedHintAdvice {

    private final WrappedService wrappedService;

    public WrappedHintAdvice(WrappedService wrappedService) {
        this.wrappedService = wrappedService;
    }

    @ModelAttribute("wrappedYear")
    public Integer wrappedYear() {
        LocalDate today = LocalDate.now();
        if (!WrappedService.isSeason(today)) return null;
        int year = WrappedService.defaultYear(today);
        return wrappedService.hasOrders(year) ? year : null;
    }
}
