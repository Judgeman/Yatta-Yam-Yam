package com.nameapp.controller;

import com.nameapp.model.*;
import com.nameapp.service.AppUserService;
import com.nameapp.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Controller
@RequestMapping("/orders")
public class OrderController {

    private final OrderService orderService;
    private final AppUserService userService;

    public OrderController(OrderService orderService, AppUserService userService) {
        this.orderService = orderService;
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
        // Read the nameapp_user cookie
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

    // ── Dashboard ─────────────────────────────────────────────────────────────

    @GetMapping("/dashboard")
    public String dashboard(HttpServletRequest request, Model model) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return redirectToHome(request);

        AppUser currentUser = user.get();
        List<FoodOrder> orders = orderService.getOpenOrders();

        // Build per-order summary info for the dashboard
        Map<Long, java.math.BigDecimal> myOpenAmounts = new java.util.HashMap<>();
        Map<Long, UserOrderSelection.PaymentMethod> myPaidMethods = new java.util.HashMap<>();
        Map<Long, Boolean> myPaidStatus = new java.util.HashMap<>();
        Map<Long, Integer> unpaidCountForOwner = new java.util.HashMap<>();
        Map<Long, java.math.BigDecimal> unpaidAmountForOwner = new java.util.HashMap<>();
        Map<Long, Integer> unpaidCountForNonOwner = new java.util.HashMap<>();
        Map<Long, java.math.BigDecimal> unpaidAmountForNonOwner = new java.util.HashMap<>();

        for (FoodOrder order : orders) {
            if (order.getStatus() != FoodOrder.OrderStatus.CLOSED) continue;

            java.math.BigDecimal tipPerPerson = orderService.getTipPerPerson(order);
            List<UserOrderSelection> selections = orderService.getSelectionsForOrder(order);

            // Current user's info for this order
            selections.stream()
                    .filter(s -> s.getUser().getId().equals(currentUser.getId()))
                    .findFirst()
                    .ifPresent(sel -> {
                        java.math.BigDecimal total = sel.getSubtotal().add(tipPerPerson);
                        myOpenAmounts.put(order.getId(), total);
                        myPaidStatus.put(order.getId(), sel.isPaid() || sel.isMarkedPaidByOwner());
                        if (sel.getPaymentMethod() != null) {
                            myPaidMethods.put(order.getId(), sel.getPaymentMethod());
                        }
                    });

            // Unpaid summary (owner gets red alert, non-owner gets gray box)
            int unpaidCount = 0;
            java.math.BigDecimal unpaidTotal = java.math.BigDecimal.ZERO;
            for (UserOrderSelection sel : selections) {
                if (!sel.isPaid() && !sel.isMarkedPaidByOwner() && !sel.getItems().isEmpty()) {
                    unpaidCount++;
                    unpaidTotal = unpaidTotal.add(sel.getSubtotal().add(tipPerPerson));
                }
            }
            if (order.getCreator().getId().equals(currentUser.getId())) {
                unpaidCountForOwner.put(order.getId(), unpaidCount);
                unpaidAmountForOwner.put(order.getId(), unpaidTotal);
            } else {
                unpaidCountForNonOwner.put(order.getId(), unpaidCount);
                unpaidAmountForNonOwner.put(order.getId(), unpaidTotal);
            }
        }

        model.addAttribute("user", currentUser);
        model.addAttribute("orders", orders);
        model.addAttribute("myOpenAmounts", myOpenAmounts);
        model.addAttribute("myPaidStatus", myPaidStatus);
        model.addAttribute("myPaidMethods", myPaidMethods);
        model.addAttribute("unpaidCountForOwner", unpaidCountForOwner);
        model.addAttribute("unpaidAmountForOwner", unpaidAmountForOwner);
        model.addAttribute("unpaidCountForNonOwner", unpaidCountForNonOwner);
        model.addAttribute("unpaidAmountForNonOwner", unpaidAmountForNonOwner);
        return "dashboard";
    }

    // ── Archive ───────────────────────────────────────────────────────────────

    @GetMapping("/archive")
    public String archive(HttpServletRequest request, Model model) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return redirectToHome(request);

        List<FoodOrder> orders = orderService.getArchivedOrders();

        Map<Long, Boolean> allPaidMap = new java.util.HashMap<>();
        Map<Long, java.math.BigDecimal> openAmountMap = new java.util.HashMap<>();

        for (FoodOrder order : orders) {
            List<UserOrderSelection> selections = orderService.getSelectionsForOrder(order);
            java.math.BigDecimal tipPerPerson = orderService.getTipPerPerson(order);

            boolean allPaid = selections.stream()
                    .filter(s -> !s.getItems().isEmpty())
                    .allMatch(s -> s.isPaid() || s.isMarkedPaidByOwner());

            java.math.BigDecimal openAmount = selections.stream()
                    .filter(s -> !s.getItems().isEmpty() && !s.isPaid() && !s.isMarkedPaidByOwner())
                    .map(s -> s.getSubtotal().add(tipPerPerson))
                    .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

            allPaidMap.put(order.getId(), allPaid);
            openAmountMap.put(order.getId(), openAmount);
        }

        model.addAttribute("user", user.get());
        model.addAttribute("orders", orders);
        model.addAttribute("allPaidMap", allPaidMap);
        model.addAttribute("openAmountMap", openAmountMap);
        return "archive";
    }

    // ── Create order form ─────────────────────────────────────────────────────

    @GetMapping("/create")
    public String createForm(HttpServletRequest request, Model model) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return redirectToHome(request);

        model.addAttribute("user", user.get());
        model.addAttribute("itemLists", orderService.getAllItemLists());
        model.addAttribute("today", LocalDate.now());
        return "order-create";
    }

    @PostMapping("/create")
    public String createOrder(@RequestParam String placeName,
                              @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate orderDate,
                              @RequestParam(required = false) Long itemListId,
                              @RequestParam(required = false) String newListName,
                              HttpServletRequest request) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        Long listId = itemListId;

        // Create a new item list if requested
        if ((itemListId == null || itemListId == 0) && newListName != null && !newListName.isBlank()) {
            ItemList newList = orderService.createItemList(newListName.trim(), user.get());
            listId = newList.getId();
        }

        FoodOrder order = orderService.createOrder(placeName, orderDate, user.get(), listId);
        return "redirect:/orders/" + order.getId();
    }

    // ── View order ────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    public String viewOrder(@PathVariable Long id, HttpServletRequest request, Model model) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return redirectToHome(request);
        return buildOrderDetailModel(id, user.get(), model, false);
    }

    // ── Edit order (owner only) ───────────────────────────────────────────────

    @GetMapping("/{id}/edit")
    public String editForm(@PathVariable Long id, HttpServletRequest request, Model model) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return redirectToHome(request);

        Optional<FoodOrder> orderOpt = orderService.findOrder(id);
        if (orderOpt.isEmpty()) return "redirect:/orders/dashboard";

        FoodOrder order = orderOpt.get();
        if (!order.getCreator().getId().equals(user.get().getId())) return "redirect:/orders/" + id;

        model.addAttribute("user", user.get());
        model.addAttribute("order", order);
        model.addAttribute("itemLists", orderService.getItemListsForUser(user.get()));
        return "order-edit";
    }

    @PostMapping("/{id}/edit")
    public String editOrder(@PathVariable Long id,
                            @RequestParam String placeName,
                            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate orderDate,
                            @RequestParam(required = false) BigDecimal tipAmount,
                            @RequestParam(required = false) String paypalLink,
                            @RequestParam(required = false) String weroLink,
                            HttpServletRequest request) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        orderService.findOrder(id).ifPresent(order -> {
            if (order.getCreator().getId().equals(user.get().getId())) {
                orderService.updateOrder(id, placeName, orderDate, tipAmount, paypalLink, weroLink);
            }
        });
        return "redirect:/orders/" + id;
    }

    // ── Close / Archive / Reopen ──────────────────────────────────────────────

    @GetMapping("/{id}/close")
    public String closeOrderForm(@PathVariable Long id, HttpServletRequest request, Model model) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        Optional<FoodOrder> orderOpt = orderService.findOrder(id);
        if (orderOpt.isEmpty()) return "redirect:/orders/dashboard";

        FoodOrder order = orderOpt.get();
        if (!order.getCreator().getId().equals(user.get().getId()))
            return "redirect:/orders/" + id;

        model.addAttribute("user", user.get());
        model.addAttribute("order", order);
        return "order-close";
    }

    @PostMapping("/{id}/close")
    public String closeOrder(@PathVariable Long id,
                             @RequestParam(required = false) BigDecimal tipAmount,
                             @RequestParam(required = false) String paypalLink,
                             @RequestParam(required = false) String weroLink,
                             HttpServletRequest request) {
        Optional<AppUser> user = currentUser(request);
        orderService.findOrder(id).ifPresent(order -> {
            if (user.isPresent() && order.getCreator().getId().equals(user.get().getId())) {
                // Save tip and links before closing
                orderService.updateOrder(order.getId(), order.getPlaceName(), order.getOrderDate(),
                        tipAmount, paypalLink, weroLink);
                orderService.closeOrder(id);
            }
        });
        return "redirect:/orders/" + id;
    }

    @PostMapping("/{id}/archive")
    public String archiveOrder(@PathVariable Long id, HttpServletRequest request) {
        Optional<AppUser> user = currentUser(request);
        orderService.findOrder(id).ifPresent(order -> {
            if (user.isPresent() && order.getCreator().getId().equals(user.get().getId()))
                orderService.archiveOrder(id);
        });
        return "redirect:/orders/dashboard";
    }

    @PostMapping("/{id}/reopen")
    public String reopenOrder(@PathVariable Long id, HttpServletRequest request) {
        Optional<AppUser> user = currentUser(request);
        orderService.findOrder(id).ifPresent(order -> {
            if (user.isPresent() && order.getCreator().getId().equals(user.get().getId()))
                orderService.reopenOrder(id);
        });
        return "redirect:/orders/" + id;
    }

    // ── Manage items in item list ─────────────────────────────────────────────

    @GetMapping("/itemlist/{listId}/items")
    public String manageItems(@PathVariable Long listId, HttpServletRequest request, Model model) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        Optional<ItemList> listOpt = orderService.findItemList(listId);
        if (listOpt.isEmpty()) return "redirect:/orders/dashboard";

        ItemList list = listOpt.get();
        if (!list.getCreator().getId().equals(user.get().getId())) return "redirect:/orders/dashboard";

        model.addAttribute("user", user.get());
        model.addAttribute("itemList", list);
        return "itemlist-manage";
    }

    @PostMapping("/itemlist/{listId}/items/add")
    public String addItem(@PathVariable Long listId,
                          @RequestParam String name,
                          @RequestParam BigDecimal price,
                          @RequestParam(required = false) String imageUrl,
                          @RequestParam(required = false) MultipartFile imageFile,
                          @RequestParam(required = false) Long orderId,
                          HttpServletRequest request) throws Exception {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        orderService.addItem(listId, name, price, imageUrl, imageFile);

        if (orderId != null) return "redirect:/orders/" + orderId;
        return "redirect:/orders/itemlist/" + listId + "/items";
    }

    @PostMapping("/itemlist/{listId}/items/{itemId}/delete")
    public String deleteItem(@PathVariable Long listId,
                             @PathVariable Long itemId,
                             @RequestParam(required = false) Long orderId,
                             HttpServletRequest request,
                             Model model) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        boolean deleteFailed = false;

        try {
            Optional<ItemList> listOpt = orderService.findItemList(listId);
            if (listOpt.isPresent() && listOpt.get().getCreator().getId().equals(user.get().getId())) {
                orderService.deleteItem(itemId);
            }
        } catch (IllegalStateException e) {
            deleteFailed = true;
        }

        if (deleteFailed && orderId != null) {
            Optional<FoodOrder> orderOpt = orderService.findOrder(orderId);
            if (orderOpt.isPresent()) {
                FoodOrder order = orderOpt.get();
                List<UserOrderSelection> selections = orderService.getSelectionsForOrder(order);
                Optional<UserOrderSelection> mySelection = selections.stream()
                        .filter(s -> s.getUser().getId().equals(user.get().getId()))
                        .findFirst();
                BigDecimal tipPerPerson = orderService.getTipPerPerson(order);

                Map<Long, Integer> itemQuantities = new java.util.HashMap<>();
                mySelection.ifPresent(sel ->
                        sel.getItems().forEach(si ->
                                itemQuantities.put(si.getItem().getId(), si.getQuantity()))
                );
                Map<Long, java.math.BigDecimal> lineTotals = new java.util.HashMap<>();
                mySelection.ifPresent(sel ->
                        sel.getItems().forEach(si ->
                                lineTotals.put(si.getId(),
                                        si.getItem().getPrice().multiply(java.math.BigDecimal.valueOf(si.getQuantity()))))
                );
                Map<Long, java.math.BigDecimal> participantTotals = new java.util.HashMap<>();
                selections.forEach(sel ->
                        participantTotals.put(sel.getId(), sel.getSubtotal().add(tipPerPerson))
                );

                model.addAttribute("user", user.get());
                model.addAttribute("order", order);
                model.addAttribute("selections", selections);
                model.addAttribute("mySelection", mySelection.orElse(null));
                model.addAttribute("total", orderService.getTotalForOrder(order));
                model.addAttribute("tipPerPerson", tipPerPerson);
                model.addAttribute("myTotal", orderService.getTotalWithTipForUser(order, user.get()));
                model.addAttribute("itemQuantities", itemQuantities);
                model.addAttribute("lineTotals", lineTotals);
                model.addAttribute("participantTotals", participantTotals);
                model.addAttribute("grandTotal", orderService.getTotalForOrder(order).add(
                        order.getTipAmount() != null ? order.getTipAmount() : java.math.BigDecimal.ZERO));
                model.addAttribute("isOwner", true);
                model.addAttribute("paymentMethods", UserOrderSelection.PaymentMethod.values());
                model.addAttribute("deleteError", true);
                return "order-detail";
            }
        }

        if (orderId != null) return "redirect:/orders/" + orderId;
        return "redirect:/orders/itemlist/" + listId + "/items";
    }

    // ── Save user selection ───────────────────────────────────────────────────

    @PostMapping("/{id}/select")
    public String saveSelection(@PathVariable Long id,
                                @RequestParam Map<String, String> params,
                                @RequestParam(required = false) String confirmedOrdered,
                                HttpServletRequest request,
                                Model model) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        Optional<FoodOrder> orderOpt = orderService.findOrder(id);
        if (orderOpt.isEmpty()) return "redirect:/orders/dashboard";

        FoodOrder order = orderOpt.get();

        // If order is ORDERED and user hasn't confirmed, show warning modal
        if (order.getStatus() == FoodOrder.OrderStatus.ORDERED
                && !"yes".equals(confirmedOrdered)) {
            // Re-render the order detail page with a flag to show the confirm modal
            return buildOrderDetailModel(id, user.get(), model, true);
        }

        Map<Long, Integer> quantities = new java.util.HashMap<>();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (entry.getKey().startsWith("qty_")) {
                try {
                    Long itemId = Long.parseLong(entry.getKey().substring(4));
                    int qty = Integer.parseInt(entry.getValue());
                    if (qty > 0) quantities.put(itemId, qty);
                } catch (NumberFormatException ignored) {}
            }
        }
        orderService.saveSelection(id, user.get(), quantities);
        return "redirect:/orders/" + id;
    }

    private String buildOrderDetailModel(Long orderId, AppUser currentUser,
                                         Model model, boolean showOrderedWarning) {
        Optional<FoodOrder> orderOpt = orderService.findOrder(orderId);
        if (orderOpt.isEmpty()) return "redirect:/orders/dashboard";

        FoodOrder order = orderOpt.get();
        List<UserOrderSelection> selections = orderService.getSelectionsForOrder(order);
        Optional<UserOrderSelection> mySelection = selections.stream()
                .filter(s -> s.getUser().getId().equals(currentUser.getId()))
                .findFirst();

        BigDecimal total = orderService.getTotalForOrder(order);
        BigDecimal tipPerPerson = orderService.getTipPerPerson(order);
        BigDecimal myTotal = orderService.getTotalWithTipForUser(order, currentUser);

        Map<Long, Integer> itemQuantities = new java.util.HashMap<>();
        mySelection.ifPresent(sel ->
                sel.getItems().forEach(si -> itemQuantities.put(si.getItem().getId(), si.getQuantity()))
        );
        Map<Long, java.math.BigDecimal> lineTotals = new java.util.HashMap<>();
        mySelection.ifPresent(sel ->
                sel.getItems().forEach(si ->
                        lineTotals.put(si.getId(),
                                si.getItem().getPrice().multiply(java.math.BigDecimal.valueOf(si.getQuantity()))))
        );
        Map<Long, java.math.BigDecimal> participantTotals = new java.util.HashMap<>();
        selections.forEach(sel ->
                participantTotals.put(sel.getId(), sel.getSubtotal().add(tipPerPerson))
        );
        Map<Long, java.math.BigDecimal> allLineTotals = new java.util.HashMap<>();
        selections.forEach(sel ->
                sel.getItems().forEach(si ->
                        allLineTotals.put(si.getId(),
                                si.getItem().getPrice().multiply(java.math.BigDecimal.valueOf(si.getQuantity()))))
        );
        Map<Long, Integer> phoneOrderQuantities = new java.util.LinkedHashMap<>();
        Map<Long, String> phoneOrderNames = new java.util.LinkedHashMap<>();
        Map<Long, java.math.BigDecimal> phoneOrderPrices = new java.util.LinkedHashMap<>();
        if (order.getItemList() != null) {
            order.getItemList().getItems().forEach(item -> {
                int totalQty = selections.stream()
                        .flatMap(sel -> sel.getItems().stream())
                        .filter(si -> si.getItem().getId().equals(item.getId()))
                        .mapToInt(SelectionItem::getQuantity)
                        .sum();
                if (totalQty > 0) {
                    phoneOrderQuantities.put(item.getId(), totalQty);
                    phoneOrderNames.put(item.getId(), item.getName());
                    phoneOrderPrices.put(item.getId(), item.getPrice());
                }
            });
        }
        Map<Long, java.math.BigDecimal> phoneOrderLineTotals = new java.util.LinkedHashMap<>();
        phoneOrderQuantities.forEach((itemId, qty) ->
                phoneOrderLineTotals.put(itemId,
                        phoneOrderPrices.get(itemId).multiply(java.math.BigDecimal.valueOf(qty)))
        );

        long unpaidCount = selections.stream()
                .filter(s -> !s.getItems().isEmpty() && !s.isPaid() && !s.isMarkedPaidByOwner())
                .count();
        BigDecimal unpaidAmount = selections.stream()
                .filter(s -> !s.getItems().isEmpty() && !s.isPaid() && !s.isMarkedPaidByOwner())
                .map(s -> s.getSubtotal().add(tipPerPerson))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        model.addAttribute("user", currentUser);
        model.addAttribute("order", order);
        model.addAttribute("selections", selections);
        model.addAttribute("mySelection", mySelection.orElse(null));
        model.addAttribute("total", total);
        model.addAttribute("tipPerPerson", tipPerPerson);
        model.addAttribute("myTotal", myTotal);
        model.addAttribute("itemQuantities", itemQuantities);
        model.addAttribute("lineTotals", lineTotals);
        model.addAttribute("participantTotals", participantTotals);
        model.addAttribute("grandTotal", total.add(order.getTipAmount() != null ? order.getTipAmount() : java.math.BigDecimal.ZERO));
        model.addAttribute("allLineTotals", allLineTotals);
        model.addAttribute("phoneOrderQuantities", phoneOrderQuantities);
        model.addAttribute("phoneOrderNames", phoneOrderNames);
        model.addAttribute("phoneOrderPrices", phoneOrderPrices);
        model.addAttribute("phoneOrderLineTotals", phoneOrderLineTotals);
        model.addAttribute("isOwner", order.getCreator().getId().equals(currentUser.getId()));
        model.addAttribute("unpaidCount", unpaidCount);
        model.addAttribute("unpaidAmount", unpaidAmount);
        model.addAttribute("paymentMethods", UserOrderSelection.PaymentMethod.values());
        model.addAttribute("showOrderedWarning", showOrderedWarning);
        return "order-detail";
    }

    // ── Mark paid ─────────────────────────────────────────────────────────────

    @PostMapping("/selection/{selId}/pay")
    public String markPaid(@PathVariable Long selId,
                           @RequestParam String method,
                           @RequestParam Long orderId,
                           HttpServletRequest request) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        orderService.findSelection(selId).ifPresent(sel -> {
            if (sel.getUser().getId().equals(user.get().getId())) {
                orderService.markSelfPaid(selId, UserOrderSelection.PaymentMethod.valueOf(method));
            }
        });
        return "redirect:/orders/" + orderId;
    }

    @PostMapping("/selection/{selId}/owner-paid")
    public String ownerMarkPaid(@PathVariable Long selId,
                                @RequestParam Long orderId,
                                @RequestParam String method,
                                HttpServletRequest request) {
        Optional<AppUser> user = currentUser(request);
        orderService.findSelection(selId).ifPresent(sel -> {
            if (user.isPresent() && sel.getOrder().getCreator().getId().equals(user.get().getId()))
                orderService.markPaidByOwner(selId, UserOrderSelection.PaymentMethod.valueOf(method));
        });
        return "redirect:/orders/" + orderId;
    }

    @PostMapping("/selection/{selId}/owner-unpaid")
    public String ownerUnmarkPaid(@PathVariable Long selId,
                                  @RequestParam Long orderId,
                                  HttpServletRequest request) {
        Optional<AppUser> user = currentUser(request);
        orderService.findSelection(selId).ifPresent(sel -> {
            if (user.isPresent() && sel.getOrder().getCreator().getId().equals(user.get().getId()))
                orderService.unmarkPaidByOwner(selId);
        });
        return "redirect:/orders/" + orderId;
    }

    @PostMapping("/selection/{selId}/unpay")
    public String unpay(@PathVariable Long selId,
                        @RequestParam Long orderId,
                        HttpServletRequest request) {
        Optional<AppUser> user = currentUser(request);
        orderService.findSelection(selId).ifPresent(sel -> {
            if (user.isPresent() && sel.getUser().getId().equals(user.get().getId()))
                orderService.unpaySelf(selId);
        });
        return "redirect:/orders/" + orderId;
    }

    @GetMapping("/itemlist/{listId}/items/{itemId}/edit")
    public String editItemForm(@PathVariable Long listId,
                               @PathVariable Long itemId,
                               @RequestParam(required = false) Long orderId,
                               HttpServletRequest request,
                               Model model) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        Optional<ItemList> listOpt = orderService.findItemList(listId);
        if (listOpt.isEmpty() || !listOpt.get().getCreator().getId().equals(user.get().getId()))
            return "redirect:/orders/dashboard";

        Optional<Item> itemOpt = orderService.findItem(itemId);
        if (itemOpt.isEmpty()) return "redirect:/orders/dashboard";

        model.addAttribute("user", user.get());
        model.addAttribute("itemList", listOpt.get());
        model.addAttribute("item", itemOpt.get());
        model.addAttribute("orderId", orderId);
        return "item-edit";
    }

    @PostMapping("/itemlist/{listId}/items/{itemId}/edit")
    public String editItem(@PathVariable Long listId,
                           @PathVariable Long itemId,
                           @RequestParam String name,
                           @RequestParam BigDecimal price,
                           @RequestParam(required = false) String imageUrl,
                           @RequestParam(required = false) MultipartFile imageFile,
                           @RequestParam(required = false) Long orderId,
                           HttpServletRequest request) throws Exception {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        Optional<ItemList> listOpt = orderService.findItemList(listId);
        if (listOpt.isPresent() && listOpt.get().getCreator().getId().equals(user.get().getId())) {
            orderService.updateItem(itemId, name, price, imageUrl, imageFile);
        }

        if (orderId != null) return "redirect:/orders/" + orderId;
        return "redirect:/orders/itemlist/" + listId + "/items";
    }

    @PostMapping("/itemlist/{listId}/rename")
    public String renameItemList(@PathVariable Long listId,
                                 @RequestParam String name,
                                 @RequestParam(required = false) Long orderId,
                                 HttpServletRequest request) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";

        orderService.findItemList(listId).ifPresent(list -> {
            if (list.getCreator().getId().equals(user.get().getId()))
                orderService.renameItemList(listId, name);
        });

        if (orderId != null) return "redirect:/orders/" + orderId;
        return "redirect:/orders/dashboard";
    }

    @PostMapping("/{id}/mark-ordered")
    public String markOrdered(@PathVariable Long id,
                              @RequestParam String contactName,
                              HttpServletRequest request) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return "redirect:/";
        orderService.findOrder(id).ifPresent(order -> {
            if (order.getStatus() == FoodOrder.OrderStatus.OPEN ||
                    order.getStatus() == FoodOrder.OrderStatus.ORDERED)
                orderService.markAsOrdered(id, contactName);
        });
        return "redirect:/orders/" + id;
    }
}
