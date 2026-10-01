package com.nameapp.controller;

import com.nameapp.model.AppUser;
import com.nameapp.model.Contact;
import com.nameapp.model.FoodOrder;
import com.nameapp.service.AppUserService;
import com.nameapp.service.ContactService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@Controller
@RequestMapping("/contacts")
public class ContactController {

    private final ContactService contactService;
    private final AppUserService userService;

    public ContactController(ContactService contactService, AppUserService userService) {
        this.contactService = contactService;
        this.userService = userService;
    }

    // ── Helper: redirect to home, preserving the intended URL in session ────────

    private String redirectToHome(HttpServletRequest request) {
        if ("GET".equalsIgnoreCase(request.getMethod())) {
            String uri = request.getRequestURI();
            String query = request.getQueryString();
            request.getSession().setAttribute("redirectAfterLogin",
                    query != null ? uri + "?" + query : uri);
        }
        return "redirect:/";
    }

    // ── Helper: get current user from cookie ─────────────────────────────────

    private Optional<AppUser> currentUser(HttpServletRequest request) {
        if (request.getCookies() == null) return Optional.empty();
        return Arrays.stream(request.getCookies())
                .filter(c -> "nameapp_user".equals(c.getName()))
                .map(c -> {
                    try {
                        String name = java.net.URLDecoder.decode(c.getValue(), java.nio.charset.StandardCharsets.UTF_8);
                        return userService.findByName(name).orElse(null);
                    } catch (Exception e) { return null; }
                })
                .filter(Objects::nonNull)
                .findFirst();
    }

    private FoodOrder.Location parseLocation(String location) {
        if (location == null || location.isBlank()) return null;
        try { return FoodOrder.Location.valueOf(location.toUpperCase()); } catch (IllegalArgumentException e) { return null; }
    }

    // ── Contact list ──────────────────────────────────────────────────────────

    @GetMapping
    public String list(HttpServletRequest request, Model model,
                       @RequestParam(required = false) String location) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return redirectToHome(request);

        FoodOrder.Location locationFilter = parseLocation(location);
        List<Contact> contacts = locationFilter != null
                ? contactService.getContactsByLocation(locationFilter)
                : contactService.getAllContacts();

        model.addAttribute("user", user.get());
        model.addAttribute("contacts", contacts);
        model.addAttribute("locations", FoodOrder.Location.values());
        model.addAttribute("selectedLocation", locationFilter != null ? locationFilter.name() : null);
        // Lets the edit form bring the user back to the same filtered list
        model.addAttribute("returnTo", locationFilter != null ? "/contacts?location=" + locationFilter.name() : "/contacts");
        return "contacts";
    }

    // ── Create contact ────────────────────────────────────────────────────────

    @GetMapping("/new")
    public String createForm(HttpServletRequest request, Model model,
                             @RequestParam(required = false) String returnTo) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return redirectToHome(request);

        model.addAttribute("user", user.get());
        model.addAttribute("contact", new Contact());
        model.addAttribute("locations", FoodOrder.Location.values());
        model.addAttribute("returnTo", safeReturnTo(returnTo));
        return "contact-edit";
    }

    @PostMapping("/new")
    public String createContact(@RequestParam String name,
                                @RequestParam String location,
                                @RequestParam(required = false) String address,
                                @RequestParam(required = false) List<String> phoneNumbers,
                                @RequestParam(required = false) String imageUrl,
                                @RequestParam(required = false) MultipartFile imageFile,
                                @RequestParam(required = false) String returnTo,
                                HttpServletRequest request) throws Exception {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        FoodOrder.Location loc = parseLocation(location);
        if (name.isBlank() || loc == null) return "redirect:/contacts/new";

        contactService.saveContact(new Contact(), name, loc, address, phoneNumbers,
                imageUrl, imageFile, false);
        return "redirect:" + safeReturnTo(returnTo);
    }

    // ── Edit contact ──────────────────────────────────────────────────────────

    @GetMapping("/{id}/edit")
    public String editForm(@PathVariable Long id, HttpServletRequest request, Model model,
                           @RequestParam(required = false) String returnTo) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return redirectToHome(request);

        Optional<Contact> contact = contactService.findContact(id);
        if (contact.isEmpty()) return "redirect:/contacts";

        model.addAttribute("user", user.get());
        model.addAttribute("contact", contact.get());
        model.addAttribute("locations", FoodOrder.Location.values());
        model.addAttribute("returnTo", safeReturnTo(returnTo));
        return "contact-edit";
    }

    @PostMapping("/{id}/edit")
    public String editContact(@PathVariable Long id,
                              @RequestParam String name,
                              @RequestParam String location,
                              @RequestParam(required = false) String address,
                              @RequestParam(required = false) List<String> phoneNumbers,
                              @RequestParam(required = false) String imageUrl,
                              @RequestParam(required = false) MultipartFile imageFile,
                              @RequestParam(required = false, defaultValue = "false") boolean removeImage,
                              @RequestParam(required = false) String returnTo,
                              HttpServletRequest request) throws Exception {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        Optional<Contact> contact = contactService.findContact(id);
        if (contact.isEmpty()) return "redirect:/contacts";

        FoodOrder.Location loc = parseLocation(location);
        if (name.isBlank() || loc == null) return "redirect:/contacts/" + id + "/edit";

        contactService.saveContact(contact.get(), name, loc, address, phoneNumbers,
                imageUrl, imageFile, removeImage);
        return "redirect:" + safeReturnTo(returnTo);
    }

    // ── Delete contact ────────────────────────────────────────────────────────

    @PostMapping("/{id}/delete")
    public String deleteContact(@PathVariable Long id, HttpServletRequest request) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        contactService.deleteContact(id);
        return "redirect:/contacts";
    }

    // Only allow redirects to local paths so the form can't be abused as an open redirect
    private String safeReturnTo(String returnTo) {
        if (returnTo != null && returnTo.startsWith("/") && !returnTo.startsWith("//")
                && !returnTo.startsWith("/\\")) return returnTo;
        return "/contacts";
    }
}
