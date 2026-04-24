package com.nameapp.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "user_order_selection")
public class UserOrderSelection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private FoodOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @OneToMany(mappedBy = "selection", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SelectionItem> items = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    private PaymentMethod paymentMethod;

    private boolean paid = false;

    // Paid by owner on behalf of this user
    private boolean markedPaidByOwner = false;

    public enum PaymentMethod {
        CASH, PAYPAL, WERO
    }

    public UserOrderSelection() {

    }

    public BigDecimal getSubtotal() {
        return items.stream()
                .map(si -> si.getItem().getPrice().multiply(BigDecimal.valueOf(si.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public FoodOrder getOrder() {
        return order;
    }

    public void setOrder(FoodOrder order) {
        this.order = order;
    }

    public AppUser getUser() {
        return user;
    }

    public void setUser(AppUser user) {
        this.user = user;
    }

    public List<SelectionItem> getItems() {
        return items;
    }

    public void setItems(List<SelectionItem> items) {
        this.items = items;
    }

    public PaymentMethod getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(PaymentMethod paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public boolean isPaid() {
        return paid;
    }

    public void setPaid(boolean paid) {
        this.paid = paid;
    }

    public boolean isMarkedPaidByOwner() {
        return markedPaidByOwner;
    }

    public void setMarkedPaidByOwner(boolean markedPaidByOwner) {
        this.markedPaidByOwner = markedPaidByOwner;
    }
}
