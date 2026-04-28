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

    public Optional<FoodOrder> findOrder(Long id) {
        return orderRepo.findById(id);
    }

    public FoodOrder createOrder(String placeName, LocalDate date, AppUser creator, Long itemListId,
                                 FoodOrder.Location location) {
        FoodOrder order = new FoodOrder();
        order.setPlaceName(placeName);
        order.setOrderDate(date);
        order.setCreator(creator);
        order.setStatus(FoodOrder.OrderStatus.OPEN);
        order.setTipAmount(BigDecimal.ZERO);
        order.setLocation(location);
        if (itemListId != null) {
            itemListRepo.findById(itemListId).ifPresent(order::setItemList);
        }

        // Pre-fill PayPal and Wero links from the creator's last order
        orderRepo.findTopByCreatorOrderByOrderDateDesc(creator).ifPresent(last -> {
            order.setPaypalLink(last.getPaypalLink());
            order.setWeroLink(last.getWeroLink());
        });

        return orderRepo.save(order);
    }

    public void updateOrder(Long orderId, String placeName, LocalDate date, BigDecimal tip,
                            String paypalLink, String weroLink) {
        orderRepo.findById(orderId).ifPresent(order -> {
            order.setPlaceName(placeName);
            order.setOrderDate(date);
            order.setTipAmount(tip != null ? tip : BigDecimal.ZERO);
            order.setPaypalLink(paypalLink != null && !paypalLink.isBlank() ? paypalLink.trim() : null);
            order.setWeroLink(weroLink != null && !weroLink.isBlank() ? weroLink.trim() : null);
            orderRepo.save(order);
        });
    }

    public void updateOrder(Long orderId, String placeName, LocalDate date, BigDecimal tip,
                            String paypalLink, String weroLink, FoodOrder.Location location) {
        orderRepo.findById(orderId).ifPresent(order -> {
            order.setPlaceName(placeName);
            order.setOrderDate(date);
            order.setTipAmount(tip != null ? tip : BigDecimal.ZERO);
            order.setPaypalLink(paypalLink != null && !paypalLink.isBlank() ? paypalLink.trim() : null);
            order.setWeroLink(weroLink != null && !weroLink.isBlank() ? weroLink.trim() : null);
            order.setLocation(location);
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

    // ── Item Lists ────────────────────────────────────────────────────────────

    public List<ItemList> getItemListsForUser(AppUser user) {
        return itemListRepo.findByCreator(user);
    }

    public ItemList createItemList(String name, AppUser creator) {
        ItemList list = new ItemList();
        list.setName(name);
        list.setCreator(creator);
        return itemListRepo.save(list);
    }

    public Optional<ItemList> findItemList(Long id) {
        return itemListRepo.findById(id);
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

    public BigDecimal getTotalWithTipForUser(FoodOrder order, AppUser user) {
        Optional<UserOrderSelection> sel = selectionRepo.findByOrderAndUser(order, user);
        if (sel.isEmpty() || sel.get().getItems().isEmpty()) return BigDecimal.ZERO;
        return sel.get().getSubtotal().add(getTipPerPerson(order));
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
