package com.nameapp.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "food_order")
public class FoodOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String placeName;

    @Column(nullable = false)
    private LocalDate orderDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_id", nullable = false)
    private AppUser creator;

    private String paypalLink;

    private String weroLink;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_list_id")
    private ItemList itemList;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "VARCHAR(255)")
    private OrderStatus status = OrderStatus.OPEN;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "VARCHAR(255)")
    private Location location;

    private String orderedByContact;

    // Tip amount entered by the creator (total tip, split per person)
    @Column(precision = 10, scale = 2)
    private BigDecimal tipAmount = BigDecimal.ZERO;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<UserOrderSelection> selections = new ArrayList<>();

    public enum OrderStatus {
        OPEN, ORDERED, CLOSED, ARCHIVED
    }

    public enum Location {
        KASSEL, FRANKFURT
    }

    public FoodOrder() {

    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPlaceName() {
        return placeName;
    }

    public void setPlaceName(String placeName) {
        this.placeName = placeName;
    }

    public LocalDate getOrderDate() {
        return orderDate;
    }

    public void setOrderDate(LocalDate orderDate) {
        this.orderDate = orderDate;
    }

    public AppUser getCreator() {
        return creator;
    }

    public void setCreator(AppUser creator) {
        this.creator = creator;
    }

    public ItemList getItemList() {
        return itemList;
    }

    public void setItemList(ItemList itemList) {
        this.itemList = itemList;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public BigDecimal getTipAmount() {
        return tipAmount;
    }

    public void setTipAmount(BigDecimal tipAmount) {
        this.tipAmount = tipAmount;
    }

    public List<UserOrderSelection> getSelections() {
        return selections;
    }

    public void setSelections(List<UserOrderSelection> selections) {
        this.selections = selections;
    }

    public String getPaypalLink() {
        return paypalLink;
    }

    public void setPaypalLink(String paypalLink) {
        this.paypalLink = paypalLink;
    }

    public String getWeroLink() {
        return weroLink;
    }

    public void setWeroLink(String weroLink) {
        this.weroLink = weroLink;
    }

    public String getOrderedByContact() {
        return orderedByContact;
    }

    public void setOrderedByContact(String orderedByContact) {
        this.orderedByContact = orderedByContact;
    }

    public Location getLocation() {
        return location;
    }

    public void setLocation(Location location) {
        this.location = location;
    }
}
