package com.nameapp.config;

import com.nameapp.service.WrappedService;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

import java.time.LocalDate;

/**
 * In December and January every page gets "wrappedYear" (the year /wrapped shows);
 * the dashboard and the overview then show a link to it. Outside that season the
 * attribute is null and the link is hidden; /wrapped itself is always reachable.
 */
@ControllerAdvice
public class WrappedBannerAdvice {

    @ModelAttribute("wrappedYear")
    public Integer wrappedYear() {
        LocalDate today = LocalDate.now();
        return WrappedService.isSeason(today) ? WrappedService.defaultYear(today) : null;
    }
}
