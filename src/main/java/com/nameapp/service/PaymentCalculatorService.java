package com.nameapp.service;

import com.nameapp.model.AppUser;
import com.nameapp.model.FoodOrder;
import com.nameapp.model.UserOrderSelection;
import com.nameapp.repository.UserOrderSelectionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Data for the payment calculator on the dashboard: every payment made for an
 * order (PayPal, Wero or cash), what others still owe for closed orders, and the
 * viewer's own open debts. The dialog filters and adds these up in the browser;
 * nothing here changes any data.
 */
@Service
@Transactional(readOnly = true)
public class PaymentCalculatorService {

    private final UserOrderSelectionRepository selectionRepo;
    private final OrderService orderService;

    public PaymentCalculatorService(UserOrderSelectionRepository selectionRepo, OrderService orderService) {
        this.selectionRepo = selectionRepo;
        this.orderService = orderService;
    }

    /**
     * All paid participations (marked as paid by the participant or confirmed by the
     * creator) of orders in any status, plus the unpaid ones of closed orders, newest
     * order first; and what the viewer still owes (same figures as the red badge in
     * the navbar).
     */
    public CalculatorData getData(AppUser viewer) {
        Map<Long, BigDecimal> perPersonCharge = new HashMap<>();
        List<Payment> payments = new ArrayList<>();

        for (UserOrderSelection sel : selectionRepo.findByPaidTrueOrMarkedPaidByOwnerTrue()) {
            if (!orderService.isParticipant(sel)) continue;
            payments.add(new Payment(sel, amountFor(sel, perPersonCharge), false));
        }

        // Not paid yet: same rules as the open debts (closed orders only, nobody owes
        // themselves). The viewer's own open amounts are left out here; they are the
        // "my debts" below and would otherwise count twice.
        for (UserOrderSelection sel : selectionRepo.findByOrder_StatusAndPaidFalseAndMarkedPaidByOwnerFalse(
                FoodOrder.OrderStatus.CLOSED)) {
            if (!orderService.isParticipant(sel)) continue;
            if (sel.getUser().getId().equals(viewer.getId())) continue;
            if (OrderService.getPayee(sel.getOrder()).equalsIgnoreCase(sel.getUser().getName())) continue;
            payments.add(new Payment(sel, amountFor(sel, perPersonCharge), true));
        }
        payments.sort(Comparator.comparing(Payment::getOrderDate).reversed()
                .thenComparing(Comparator.comparing(Payment::getOrderId).reversed())
                .thenComparing(Payment::getParticipant, String.CASE_INSENSITIVE_ORDER));

        List<Debt> debts = new ArrayList<>();
        for (OrderService.OpenDebt debt : orderService.getOpenDebts(viewer)) {
            debts.add(new Debt(debt));
        }

        return new CalculatorData(payments, debts);
    }

    /** Own items + tip share or cost share; the per-person charge is computed once per order. */
    private BigDecimal amountFor(UserOrderSelection sel, Map<Long, BigDecimal> perPersonCharge) {
        FoodOrder order = sel.getOrder();
        BigDecimal charge = perPersonCharge.computeIfAbsent(order.getId(),
                id -> orderService.getPerPersonCharge(order));
        return sel.getSubtotal().add(charge);
    }

    /** Amount in cents, so the browser adds up integers instead of floating-point euros. */
    static long toCents(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP).movePointRight(2).longValueExact();
    }

    // ── JSON view objects (serialized via their getters) ─────────────────────

    public static class CalculatorData {
        private final List<Payment> payments;
        private final List<Debt> debts;

        public CalculatorData(List<Payment> payments, List<Debt> debts) {
            this.payments = payments;
            this.debts = debts;
        }

        public List<Payment> getPayments() { return payments; }
        public List<Debt> getDebts() { return debts; }
    }

    /** One participant's payment for one order, or the amount still open ({@link #isOpen()}). */
    public static class Payment {
        private final Long id;
        private final Long orderId;
        private final String place;
        private final String orderDate;
        private final String status;
        private final String owner;
        private final String paidBy;
        private final String participant;
        private final String method;
        private final long amountCents;
        private final String paypalLink;
        private final String weroLink;
        private final boolean open;

        Payment(UserOrderSelection sel, BigDecimal amount, boolean open) {
            FoodOrder order = sel.getOrder();
            this.id = sel.getId();
            this.orderId = order.getId();
            this.place = order.getPlaceName();
            this.orderDate = order.getOrderDate().toString();
            this.status = order.getStatus().name();
            this.owner = order.getCreator().getName();
            this.paidBy = OrderService.getPayee(order);
            this.participant = sel.getUser().getName();
            this.method = sel.getPaymentMethod() != null ? sel.getPaymentMethod().name() : null;
            this.amountCents = toCents(amount);
            this.paypalLink = order.getPaypalLink();
            this.weroLink = order.getWeroLink();
            this.open = open;
        }

        public Long getId() { return id; }
        public Long getOrderId() { return orderId; }
        public String getPlace() { return place; }
        /** ISO date (yyyy-MM-dd), compared as text by the date filter. */
        public String getOrderDate() { return orderDate; }
        public String getStatus() { return status; }
        /** Creator of the order. */
        public String getOwner() { return owner; }
        /** Who receives the money: the payer ("Paid by"), or the creator if none is set. */
        public String getPaidBy() { return paidBy; }
        public String getParticipant() { return participant; }
        /** CASH, PAYPAL, WERO, or null on old rows without a method. */
        public String getMethod() { return method; }
        public long getAmountCents() { return amountCents; }
        public String getPaypalLink() { return paypalLink; }
        public String getWeroLink() { return weroLink; }
        /** Not paid yet: the participant still owes this amount (closed orders only). */
        public boolean isOpen() { return open; }
    }

    /** Something the viewer still owes for a closed order. */
    public static class Debt {
        private final Long orderId;
        private final String place;
        private final String orderDate;
        private final String payee;
        private final long amountCents;

        Debt(OrderService.OpenDebt debt) {
            this.orderId = debt.getOrder().getId();
            this.place = debt.getOrder().getPlaceName();
            this.orderDate = debt.getOrder().getOrderDate().toString();
            this.payee = debt.getPayee();
            this.amountCents = toCents(debt.getAmount());
        }

        public Long getOrderId() { return orderId; }
        public String getPlace() { return place; }
        public String getOrderDate() { return orderDate; }
        public String getPayee() { return payee; }
        public long getAmountCents() { return amountCents; }
    }
}
