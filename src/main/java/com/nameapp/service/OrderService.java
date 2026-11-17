package com.nameapp.service;

import com.nameapp.model.*;
import com.nameapp.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.*;
import java.time.LocalDate;
import java.util.*;

@Service
@Transactional
public class OrderService {

    private final FoodOrderRepository orderRepo;
    private final ItemListRepository itemListRepo;
    private final ItemRepository itemRepo;
    private final UserOrderSelectionRepository selectionRepo;
    private final SelectionItemRepository selectionItemRepo;

    private static final String UPLOAD_DIR = "uploads/";

    public OrderService(FoodOrderRepository orderRepo,
                        ItemListRepository itemListRepo,
                        ItemRepository itemRepo,
                        UserOrderSelectionRepository selectionRepo,
                        SelectionItemRepository selectionItemRepo) {
        this.orderRepo = orderRepo;
        this.itemListRepo = itemListRepo;
        this.itemRepo = itemRepo;
        this.selectionRepo = selectionRepo;
        this.selectionItemRepo = selectionItemRepo;
    }

    // ── Orders ────────────────────────────────────────────────────────────────

    public List<FoodOrder> getOpenOrders() {
        return orderRepo.findByStatusNotOrderByOrderDateDesc(FoodOrder.OrderStatus.ARCHIVED);
    }

    public List<FoodOrder> getOpenOrdersByLocation(FoodOrder.Location location) {
        return orderRepo.findByStatusNotAndLocationOrderByOrderDateDesc(FoodOrder.OrderStatus.ARCHIVED, location);
    }

    public List<FoodOrder> getArchivedOrders() {
        return orderRepo.findByStatusOrderByOrderDateDesc(FoodOrder.OrderStatus.ARCHIVED);
    }

    public List<FoodOrder> getArchivedOrdersByLocation(FoodOrder.Location location) {
        return orderRepo.findByStatusAndLocationOrderByOrderDateDesc(FoodOrder.OrderStatus.ARCHIVED, location);
    }

    public Optional<FoodOrder> findOrder(Long id) {
        return orderRepo.findById(id);
    }

    // Creator's most recent order — its PayPal/Wero links pre-fill the create form
    public Optional<FoodOrder> findLastOrderByCreator(AppUser creator) {
        return orderRepo.findTopByCreatorOrderByOrderDateDesc(creator);
    }

    public FoodOrder createOrder(String placeName, LocalDate date, AppUser creator, Long itemListId,
                                 FoodOrder.Location location, String paypalLink, String weroLink,
                                 String paidByName, FoodOrder.OrderType orderType, BigDecimal splitTotal) {
        FoodOrder order = new FoodOrder();
        order.setPlaceName(placeName);
        order.setOrderDate(date);
        order.setCreator(creator);
        order.setStatus(FoodOrder.OrderStatus.OPEN);
        order.setTipAmount(BigDecimal.ZERO);
        order.setLocation(location);
        order.setOrderType(orderType != null ? orderType : FoodOrder.OrderType.ITEMS);
        if (order.isSplitOrder()) {
            order.setSplitTotal(positiveOrNull(splitTotal));
        } else if (itemListId != null) {
            itemListRepo.findById(itemListId).ifPresent(order::setItemList);
        }
        order.setPaypalLink(paypalLink != null && !paypalLink.isBlank() ? paypalLink.trim() : null);
        order.setWeroLink(weroLink != null && !weroLink.isBlank() ? weroLink.trim() : null);
        order.setPaidByName(paidByName != null && !paidByName.isBlank() ? paidByName.trim() : null);

        return orderRepo.save(order);
    }

    public void updateOrder(Long orderId, String placeName, LocalDate date, BigDecimal tip,
                            String paypalLink, String weroLink, FoodOrder.Location location,
                            String paidByName, BigDecimal splitTotal) {
        orderRepo.findById(orderId).ifPresent(order -> {
            order.setPlaceName(placeName);
            order.setOrderDate(date);
            if (order.isSplitOrder()) {
                // No tip on split orders: everything is part of the total amount
                order.setTipAmount(BigDecimal.ZERO);
                BigDecimal newTotal = positiveOrNull(splitTotal);
                // Once closed, the total can be changed but no longer removed
                boolean closed = order.getStatus() == FoodOrder.OrderStatus.CLOSED
                        || order.getStatus() == FoodOrder.OrderStatus.ARCHIVED;
                if (newTotal != null || !closed) {
                    order.setSplitTotal(newTotal);
                }
            } else {
                order.setTipAmount(tip != null ? tip : BigDecimal.ZERO);
            }
            order.setPaypalLink(paypalLink != null && !paypalLink.isBlank() ? paypalLink.trim() : null);
            order.setWeroLink(weroLink != null && !weroLink.isBlank() ? weroLink.trim() : null);
            order.setLocation(location);
            order.setPaidByName(paidByName != null && !paidByName.isBlank() ? paidByName.trim() : null);
            orderRepo.save(order);
        });
    }

    public void closeOrder(Long orderId) {
        orderRepo.findById(orderId).ifPresent(order -> {
            order.setStatus(FoodOrder.OrderStatus.CLOSED);
            orderRepo.save(order);
        });
    }

    public void archiveOrder(Long orderId) {
        orderRepo.findById(orderId).ifPresent(order -> {
            order.setStatus(FoodOrder.OrderStatus.ARCHIVED);
            orderRepo.save(order);
        });
    }

    public void reopenOrder(Long orderId) {
        orderRepo.findById(orderId).ifPresent(order -> {
            order.setStatus(FoodOrder.OrderStatus.OPEN);
            order.setOrderedByContact(null);
            orderRepo.save(order);
        });
    }

    private static BigDecimal positiveOrNull(BigDecimal amount) {
        return amount != null && amount.compareTo(BigDecimal.ZERO) > 0 ? amount : null;
    }

    // ── Item Lists ────────────────────────────────────────────────────────────

    public List<ItemList> getItemListsForUser(AppUser user) {
        return itemListRepo.findByCreator(user);
    }

    public ItemList createItemList(String name, AppUser creator, boolean visible) {
        ItemList list = new ItemList();
        list.setName(name);
        list.setCreator(creator);
        list.setVisible(visible);
        return itemListRepo.save(list);
    }

    public Optional<ItemList> findItemList(Long id) {
        return itemListRepo.findById(id);
    }

    public void setItemListVisible(Long listId, boolean visible) {
        itemListRepo.findById(listId).ifPresent(list -> {
            list.setVisible(visible);
            itemListRepo.save(list);
        });
    }

    // ── Items ─────────────────────────────────────────────────────────────────

    public Item addItem(Long itemListId, String name, BigDecimal price,
                        String imageUrl, MultipartFile imageFile) throws IOException {
        ItemList list = itemListRepo.findById(itemListId)
                .orElseThrow(() -> new IllegalArgumentException("ItemList not found"));

        Item item = new Item();
        item.setName(name);
        item.setPrice(price);
        item.setItemList(list);

        // Handle image: file upload takes priority over URL
        if (imageFile != null && !imageFile.isEmpty()) {
            String filename = UUID.randomUUID() + "_" + imageFile.getOriginalFilename();
            Path uploadPath = Paths.get(UPLOAD_DIR);
            Files.createDirectories(uploadPath);
            Files.copy(imageFile.getInputStream(), uploadPath.resolve(filename),
                    StandardCopyOption.REPLACE_EXISTING);
            item.setImageUrl("/uploads/" + filename);
        } else if (imageUrl != null && !imageUrl.isBlank()) {
            item.setImageUrl(imageUrl.trim());
        }

        return itemRepo.save(item);
    }

    public boolean canDeleteItem(Long itemId) {
        return selectionItemRepo.findAll().stream()
                .noneMatch(si -> si.getItem().getId().equals(itemId));
    }

    public void deleteItem(Long itemId) {
        if (!canDeleteItem(itemId)) {
            throw new IllegalStateException("Item is already ordered and cannot be deleted.");
        }
        itemRepo.deleteById(itemId);
    }

    // ── Selections ────────────────────────────────────────────────────────────

    public UserOrderSelection getOrCreateSelection(FoodOrder order, AppUser user) {
        return selectionRepo.findByOrderAndUser(order, user).orElseGet(() -> {
            UserOrderSelection sel = new UserOrderSelection();
            sel.setOrder(order);
            sel.setUser(user);
            return selectionRepo.save(sel);
        });
    }

    public void saveSelection(Long orderId, AppUser user, Map<Long, Integer> itemQuantities) {
        FoodOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));

        boolean hasItems = itemQuantities.values().stream().anyMatch(qty -> qty > 0);

        // If all quantities are zero, remove the selection entirely
        selectionRepo.findByOrderAndUser(order, user).ifPresent(existing -> {
            if (!hasItems) {
                selectionRepo.delete(existing);
            }
        });

        if (!hasItems) return;

        UserOrderSelection selection = getOrCreateSelection(order, user);

        // Clear existing items
        selection.getItems().clear();
        selectionRepo.save(selection);

        // Add new items
        for (Map.Entry<Long, Integer> entry : itemQuantities.entrySet()) {
            if (entry.getValue() > 0) {
                Item item = itemRepo.findById(entry.getKey())
                        .orElseThrow(() -> new IllegalArgumentException("Item not found"));
                SelectionItem si = new SelectionItem();
                si.setSelection(selection);
                si.setItem(item);
                si.setQuantity(entry.getValue());
                selection.getItems().add(si);
            }
        }
        selectionRepo.save(selection);
    }

    // ── Split orders: join / leave ────────────────────────────────────────────

    public void joinSplitOrder(Long orderId, AppUser user) {
        orderRepo.findById(orderId).ifPresent(order -> {
            if (order.isSplitOrder() && order.getStatus() == FoodOrder.OrderStatus.OPEN) {
                getOrCreateSelection(order, user);
            }
        });
    }

    public void leaveSplitOrder(Long orderId, AppUser user) {
        orderRepo.findById(orderId).ifPresent(order -> {
            if (order.isSplitOrder() && order.getStatus() == FoodOrder.OrderStatus.OPEN) {
                selectionRepo.findByOrderAndUser(order, user).ifPresent(selectionRepo::delete);
            }
        });
    }

    public void markSelfPaid(Long selectionId, UserOrderSelection.PaymentMethod method) {
        selectionRepo.findById(selectionId).ifPresent(sel -> {
            sel.setPaid(true);
            sel.setPaymentMethod(method);
            selectionRepo.save(sel);
        });
    }

    public void markPaidByOwner(Long selectionId, UserOrderSelection.PaymentMethod method) {
        selectionRepo.findById(selectionId).ifPresent(sel -> {
            sel.setMarkedPaidByOwner(true);
            sel.setPaymentMethod(method);
            selectionRepo.save(sel);
        });
    }

    public void unmarkPaidByOwner(Long selectionId) {
        selectionRepo.findById(selectionId).ifPresent(sel -> {
            sel.setMarkedPaidByOwner(false);
            sel.setPaid(false);
            sel.setPaymentMethod(null);
            selectionRepo.save(sel);
        });
    }

    public List<UserOrderSelection> getSelectionsForOrder(FoodOrder order) {
        return selectionRepo.findByOrder(order);
    }

    public Optional<UserOrderSelection> findSelection(Long id) {
        return selectionRepo.findById(id);
    }

    // ── Cost calculations ─────────────────────────────────────────────────────

    public BigDecimal getTotalForOrder(FoodOrder order) {
        return selectionRepo.findByOrder(order).stream()
                .map(UserOrderSelection::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public BigDecimal getTipPerPerson(FoodOrder order) {
        List<UserOrderSelection> selections = selectionRepo.findByOrder(order);
        long count = selections.stream()
                .filter(s -> !s.getItems().isEmpty())
                .count();
        if (count == 0 || order.getTipAmount() == null
                || order.getTipAmount().compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return order.getTipAmount().divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    }

    /**
     * Whether a selection counts as a participant who has to pay: on item orders
     * only with at least one item, on split orders everyone who joined.
     */
    public boolean isParticipant(UserOrderSelection selection) {
        return selection.getOrder().isSplitOrder() || !selection.getItems().isEmpty();
    }

    /**
     * Split orders: total amount divided by the number of participants, rounded up
     * to the cent so the person who paid never ends up short. Null if no total is
     * set yet or nobody has joined. While the order is open this is the maximum
     * share — it drops with every person who joins.
     */
    public BigDecimal getSplitShare(FoodOrder order) {
        if (!order.isSplitOrder() || order.getSplitTotal() == null) return null;
        long count = selectionRepo.findByOrder(order).size();
        if (count == 0) return null;
        return order.getSplitTotal().divide(BigDecimal.valueOf(count), 2, RoundingMode.UP);
    }

    /**
     * Amount every participant pays on top of their own items: the tip share on
     * item orders, the cost share on split orders (which have no items).
     */
    public BigDecimal getPerPersonCharge(FoodOrder order) {
        if (order.isSplitOrder()) {
            BigDecimal share = getSplitShare(order);
            return share != null ? share : BigDecimal.ZERO;
        }
        return getTipPerPerson(order);
    }

    public BigDecimal getTotalWithTipForUser(FoodOrder order, AppUser user) {
        Optional<UserOrderSelection> sel = selectionRepo.findByOrderAndUser(order, user);
        if (sel.isEmpty() || !isParticipant(sel.get())) return BigDecimal.ZERO;
        return sel.get().getSubtotal().add(getPerPersonCharge(order));
    }

    public void unpaySelf(Long selectionId) {
        selectionRepo.findById(selectionId).ifPresent(sel -> {
            sel.setPaid(false);
            sel.setPaymentMethod(null);
            selectionRepo.save(sel);
        });
    }

    public List<ItemList> getAllItemLists() {
        return itemListRepo.findAll();
    }

    // Lists offered when creating a new order (hidden ones are excluded).
    public List<ItemList> getVisibleItemLists() {
        return itemListRepo.findByVisibleTrueOrderByIdDesc();
    }

    // All lists including hidden ones — for the hidden item-list admin page.
    public List<ItemList> getAllItemListsNewestFirst() {
        return itemListRepo.findAllByOrderByIdDesc();
    }

    public void updateItem(Long itemId, String name, BigDecimal price,
                           String imageUrl, MultipartFile imageFile) throws IOException {
        itemRepo.findById(itemId).ifPresent(item -> {
            item.setName(name);
            item.setPrice(price);
            try {
                if (imageFile != null && !imageFile.isEmpty()) {
                    String filename = UUID.randomUUID() + "_" + imageFile.getOriginalFilename();
                    Path uploadPath = Paths.get(UPLOAD_DIR);
                    Files.createDirectories(uploadPath);
                    Files.copy(imageFile.getInputStream(), uploadPath.resolve(filename),
                            StandardCopyOption.REPLACE_EXISTING);
                    item.setImageUrl("/uploads/" + filename);
                } else if (imageUrl != null && !imageUrl.isBlank()) {
                    item.setImageUrl(imageUrl.trim());
                }
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
            itemRepo.save(item);
        });
    }

    public Optional<Item> findItem(Long itemId) {
        return itemRepo.findById(itemId);
    }

    public void renameItemList(Long listId, String newName) {
        itemListRepo.findById(listId).ifPresent(list -> {
            list.setName(newName.trim());
            itemListRepo.save(list);
        });
    }

    public void markAsOrdered(Long orderId, String contactName) {
        orderRepo.findById(orderId).ifPresent(order -> {
            order.setStatus(FoodOrder.OrderStatus.ORDERED);
            order.setOrderedByContact(contactName.trim());
            orderRepo.save(order);
        });
    }
}
