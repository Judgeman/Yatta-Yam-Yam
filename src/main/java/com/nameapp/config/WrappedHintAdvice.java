package com.nameapp.config;

import com.nameapp.service.WrappedService;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

import java.time.LocalDate;

/**
 * In January every page gets "wrappedYear" (the past year, which /wrapped shows).
 * fragments/theme.html then adds a small hint at the bottom right of every page with
 * a logged-in user. Outside January the attribute is null and there is no hint;
 * /wrapped itself stays reachable for past years.
 */
@ControllerAdvice
public class WrappedHintAdvice {

    @ModelAttribute("wrappedYear")
    public Integer wrappedYear() {
        LocalDate today = LocalDate.now();
        return WrappedService.isSeason(today) ? WrappedService.defaultYear(today) : null;
    }
}
