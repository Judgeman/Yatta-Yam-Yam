package com.nameapp.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import java.time.LocalDate;

/**
 * Preview of the year-end review for testing before January: /wrapped?preview=on
 * makes the Wrapped rules act, for this browser session only, as if it were already
 * 1 January of next year. The running year then shows up on /wrapped (with the
 * orders so far) and the January hint appears on every page. /wrapped?preview=off
 * (or the end of the session) switches it off. Nobody else is affected.
 */
public final class WrappedPreview {

    private static final String SESSION_ATTRIBUTE = "wrappedPreview";

    private WrappedPreview() {
    }

    public static boolean isOn(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session != null && Boolean.TRUE.equals(session.getAttribute(SESSION_ATTRIBUTE));
    }

    public static void set(HttpServletRequest request, boolean on) {
        if (on) {
            request.getSession().setAttribute(SESSION_ATTRIBUTE, Boolean.TRUE);
        } else {
            HttpSession session = request.getSession(false);
            if (session != null) session.removeAttribute(SESSION_ATTRIBUTE);
        }
    }

    /** The date the Wrapped rules go by: today, or 1 January of next year in preview. */
    public static LocalDate today(HttpServletRequest request) {
        LocalDate today = LocalDate.now();
        return isOn(request) ? LocalDate.of(today.getYear() + 1, 1, 1) : today;
    }
}
