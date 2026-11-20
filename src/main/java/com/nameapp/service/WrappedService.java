package com.nameapp.service;

import com.nameapp.model.AppUser;
import com.nameapp.model.FoodOrder;
import com.nameapp.model.SelectionItem;
import com.nameapp.model.UserOrderSelection;
import com.nameapp.repository.FoodOrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Year-end review ("Wrapped"): what was ordered in one year, per location and for
 * one user.
 *
 * Only orders dated in that year that are CLOSED or ARCHIVED count (their amounts
 * are final), and only if somebody took part: on item orders everyone with at least
 * one item, on cost splits everyone who joined (see OrderService.isParticipant).
 */
@Service
@Transactional(readOnly = true)
public class WrappedService {

    private static final List<FoodOrder.OrderStatus> COMPLETED =
            List.of(FoodOrder.OrderStatus.CLOSED, FoodOrder.OrderStatus.ARCHIVED);

    private final FoodOrderRepository orderRepo;
    private final OrderService orderService;

    public WrappedService(FoodOrderRepository orderRepo, OrderService orderService) {
        this.orderRepo = orderRepo;
        this.orderService = orderService;
    }

    // ── Season ────────────────────────────────────────────────────────────────
    // A year's review is only offered once the year is over: Wrapped 2026 from
    // 1 January 2027 on. The running year is never shown.

    /** The past year: the one the January hint links to. */
    public static int defaultYear(LocalDate today) {
        return today.getYear() - 1;
    }

    /** Whether the review of this year may be shown: only years that are over. */
    public static boolean isAvailable(int year, LocalDate today) {
        return year < today.getYear();
    }

    /** January: every page shows a small hint at the bottom right linking to the review. */
    public static boolean isSeason(LocalDate today) {
        return today.getMonthValue() == 1;
    }

    /** Whether the year has at least one closed or archived order. */
    public boolean hasOrders(int year) {
        return orderRepo.existsByOrderDateBetweenAndStatusIn(
                LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31), COMPLETED);
    }

    /** Past years with at least one closed or archived order, newest first. */
    public List<Integer> getYearsWithOrders(LocalDate today) {
        return orderRepo.findOrderDatesByStatusIn(COMPLETED).stream()
                .map(LocalDate::getYear)
                .filter(year -> isAvailable(year, today))
                .distinct()
                .sorted(Comparator.reverseOrder())
                .collect(Collectors.toList());
    }

    /** One card per past year with orders for the overview on /wrapped, newest first. */
    public List<YearSummary> getYearSummaries(AppUser user, LocalDate today) {
        List<YearSummary> summaries = new ArrayList<>();
        for (int year : getYearsWithOrders(today)) {
            Wrapped wrapped = build(year, user);
            if (wrapped.overall.isEmpty()) continue;
            summaries.add(new YearSummary(year, wrapped.overall, wrapped.me));
        }
        return summaries;
    }

    // ── Building the review ───────────────────────────────────────────────────

    public Wrapped build(int year, AppUser user) {
        List<OrderFacts> facts = loadOrders(year);

        Wrapped wrapped = new Wrapped(year);
        wrapped.overall = groupStats("Yatta-Yam-Yam", facts);
        wrapped.me = personalStats(user, facts);

        for (FoodOrder.Location location : FoodOrder.Location.values()) {
            List<OrderFacts> atLocation = facts.stream()
                    .filter(f -> f.order.getLocation() == location)
                    .collect(Collectors.toList());
            wrapped.locations.add(groupStats(displayName(location), atLocation));
        }
        // The user's own location first
        if (wrapped.me.homeLocation != null) {
            String home = displayName(wrapped.me.homeLocation);
            wrapped.locations.sort(Comparator.comparing((GroupStats g) -> !g.name.equals(home)));
        }
        wrapped.duel = buildDuel(wrapped.getActiveLocations());
        return wrapped;
    }

    private List<OrderFacts> loadOrders(int year) {
        List<FoodOrder> orders = orderRepo.findByOrderDateBetweenAndStatusInOrderByOrderDateAscIdAsc(
                LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31), COMPLETED);

        List<OrderFacts> facts = new ArrayList<>();
        for (FoodOrder order : orders) {
            List<UserOrderSelection> participants = order.getSelections().stream()
                    .filter(orderService::isParticipant)
                    .collect(Collectors.toList());
            if (participants.isEmpty()) continue;

            BigDecimal food;
            BigDecimal tip;
            if (order.isSplitOrder()) {
                food = order.getSplitTotal() != null ? order.getSplitTotal() : BigDecimal.ZERO;
                tip = BigDecimal.ZERO;
            } else {
                food = participants.stream()
                        .map(UserOrderSelection::getSubtotal)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                tip = order.getTipAmount() != null ? order.getTipAmount() : BigDecimal.ZERO;
            }
            facts.add(new OrderFacts(order, participants, food, tip, orderService.getPerPersonCharge(order)));
        }
        return facts;
    }

    private GroupStats groupStats(String name, List<OrderFacts> facts) {
        GroupStats stats = new GroupStats(name);
        Tally products = new Tally();
        Tally places = new Tally();
        Tally weekdays = new Tally();
        Tally months = new Tally();
        Set<Long> people = new HashSet<>();
        BigDecimal itemOrderFood = BigDecimal.ZERO;
        int itemOrders = 0;

        for (OrderFacts f : facts) {
            stats.orderCount++;
            stats.totalPaid = stats.totalPaid.add(f.food).add(f.tip);
            stats.tipTotal = stats.tipTotal.add(f.tip);
            if (!f.order.isSplitOrder()) {
                itemOrders++;
                itemOrderFood = itemOrderFood.add(f.food);
            }
            places.add(f.order.getPlaceName(), 1, null);
            weekdays.add(weekdayName(f.order.getOrderDate()), 1, null);
            months.add(monthName(f.order.getOrderDate()), 1, null);

            for (UserOrderSelection sel : f.participants) {
                people.add(sel.getUser().getId());
                for (SelectionItem si : sel.getItems()) {
                    stats.dishCount += si.getQuantity();
                    products.add(si.getItem().getName(), si.getQuantity(), f.order.getPlaceName());
                }
            }
            if (stats.biggestOrder == null || f.participants.size() > stats.biggestOrderPeople) {
                stats.biggestOrder = f.order;
                stats.biggestOrderPeople = f.participants.size();
            }
        }

        stats.peopleCount = people.size();
        // Average over all item orders, including those without a tip
        if (itemOrders > 0) {
            stats.avgTip = stats.tipTotal.divide(BigDecimal.valueOf(itemOrders), 2, RoundingMode.HALF_UP);
        }
        if (itemOrderFood.signum() > 0) {
            stats.tipPercent = stats.tipTotal.multiply(BigDecimal.valueOf(100))
                    .divide(itemOrderFood, 1, RoundingMode.HALF_UP);
        }
        stats.topProducts = products.top(3);
        stats.topRestaurant = places.first();
        stats.busiestWeekday = weekdays.first();
        stats.busiestMonth = months.first();
        return stats;
    }

    private PersonalStats personalStats(AppUser user, List<OrderFacts> facts) {
        PersonalStats me = new PersonalStats(user.getName());
        Tally items = new Tally();
        Tally places = new Tally();
        Tally weekdays = new Tally();
        Tally months = new Tally();
        Map<FoodOrder.Location, Integer> locationCounts = new EnumMap<>(FoodOrder.Location.class);
        Map<Long, Integer> ordersPerUser = new HashMap<>();

        for (OrderFacts f : facts) {
            FoodOrder order = f.order;
            for (UserOrderSelection sel : f.participants) {
                ordersPerUser.merge(sel.getUser().getId(), 1, Integer::sum);
            }
            if (order.getCreator().getId().equals(user.getId())) {
                me.ordersOrganised++;
            }
            // Same rule as the open payments: whoever is "Paid by", else the creator
            if (OrderService.getPayee(order).equalsIgnoreCase(user.getName())) {
                me.paidUpfrontCount++;
                me.paidUpfrontAmount = me.paidUpfrontAmount.add(f.food).add(f.tip);
            }

            UserOrderSelection mine = f.participants.stream()
                    .filter(s -> s.getUser().getId().equals(user.getId()))
                    .findFirst()
                    .orElse(null);
            if (mine == null) continue;

            BigDecimal amount = mine.getSubtotal().add(f.perPersonCharge);
            me.orderCount++;
            me.spent = me.spent.add(amount);
            if (order.isSplitOrder()) {
                me.costSplitCount++;
            } else {
                me.tipGiven = me.tipGiven.add(f.perPersonCharge);
            }
            if (me.firstOrder == null) me.firstOrder = order;
            me.lastOrder = order;
            if (me.biggestOrder == null || amount.compareTo(me.biggestOrderAmount) > 0) {
                me.biggestOrder = order;
                me.biggestOrderAmount = amount;
            }
            if (order.getLocation() != null) {
                locationCounts.merge(order.getLocation(), 1, Integer::sum);
            }
            places.add(order.getPlaceName(), 1, null);
            weekdays.add(weekdayName(order.getOrderDate()), 1, null);
            months.add(monthName(order.getOrderDate()), 1, null);
            for (SelectionItem si : mine.getItems()) {
                me.dishCount += si.getQuantity();
                items.add(si.getItem().getName(), si.getQuantity(), order.getPlaceName());
            }
        }

        if (me.orderCount > 0) {
            me.avgPerOrder = me.spent.divide(BigDecimal.valueOf(me.orderCount), 2, RoundingMode.HALF_UP);
            // Competition ranking: people with the same number of orders share a place
            int mineCount = me.orderCount;
            me.rank = 1 + (int) ordersPerUser.values().stream().filter(c -> c > mineCount).count();
            me.rankOf = ordersPerUser.size();
        }
        me.homeLocation = locationCounts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
        me.topItems = items.top(3);
        me.favouriteRestaurant = places.first();
        me.favouriteWeekday = weekdays.first();
        me.busiestMonth = months.first();
        return me;
    }

    /** Side-by-side comparison when at least two locations have orders. */
    private List<DuelRow> buildDuel(List<GroupStats> locations) {
        List<DuelRow> rows = new ArrayList<>();
        if (locations.size() < 2) return rows;
        rows.add(new DuelRow("Orders", false,
                locations.stream().map(g -> BigDecimal.valueOf(g.orderCount)).collect(Collectors.toList())));
        rows.add(new DuelRow("Dishes", false,
                locations.stream().map(g -> BigDecimal.valueOf(g.dishCount)).collect(Collectors.toList())));
        rows.add(new DuelRow("Paid in total", true,
                locations.stream().map(g -> g.totalPaid).collect(Collectors.toList())));
        rows.add(new DuelRow("Ø tip per order", true,
                locations.stream().map(g -> g.avgTip).collect(Collectors.toList())));
        rows.add(new DuelRow("People", false,
                locations.stream().map(g -> BigDecimal.valueOf(g.peopleCount)).collect(Collectors.toList())));
        return rows;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String displayName(FoodOrder.Location location) {
        String n = location.name().toLowerCase(Locale.ROOT);
        return Character.toUpperCase(n.charAt(0)) + n.substring(1);
    }

    private static String weekdayName(LocalDate date) {
        return date.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH);
    }

    private static String monthName(LocalDate date) {
        return date.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH);
    }

    /** One counted order with its final amounts. */
    private static class OrderFacts {
        final FoodOrder order;
        final List<UserOrderSelection> participants;
        // Item orders: sum of all items; cost splits: the split total
        final BigDecimal food;
        final BigDecimal tip;
        // Tip share (item orders) or cost share (cost splits) per participant
        final BigDecimal perPersonCharge;

        OrderFacts(FoodOrder order, List<UserOrderSelection> participants,
                   BigDecimal food, BigDecimal tip, BigDecimal perPersonCharge) {
            this.order = order;
            this.participants = participants;
            this.food = food;
            this.tip = tip;
            this.perPersonCharge = perPersonCharge;
        }
    }

    /**
     * Counts names case-insensitively (the first spelling seen is shown) and, per
     * name, a detail such as the restaurant. Ties keep the order of first appearance,
     * i.e. the earlier one wins.
     */
    private static class Tally {
        private final Map<String, String> display = new HashMap<>();
        private final Map<String, Long> counts = new LinkedHashMap<>();
        private final Map<String, Map<String, Long>> details = new HashMap<>();

        void add(String name, long amount, String detail) {
            if (name == null || name.isBlank()) return;
            String key = name.trim().toLowerCase(Locale.ROOT);
            display.putIfAbsent(key, name.trim());
            counts.merge(key, amount, Long::sum);
            if (detail != null && !detail.isBlank()) {
                details.computeIfAbsent(key, k -> new LinkedHashMap<>()).merge(detail.trim(), amount, Long::sum);
            }
        }

        List<Ranked> top(int limit) {
            return counts.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .limit(limit)
                    .map(e -> new Ranked(display.get(e.getKey()), e.getValue(), topDetail(e.getKey())))
                    .collect(Collectors.toList());
        }

        Ranked first() {
            List<Ranked> top = top(1);
            return top.isEmpty() ? null : top.get(0);
        }

        private String topDetail(String key) {
            Map<String, Long> d = details.get(key);
            if (d == null) return null;
            return d.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .map(Map.Entry::getKey)
                    .findFirst()
                    .orElse(null);
        }
    }

    // ── Results (read by wrapped.html and wrapped-years.html) ─────────────────

    /** Key figures of one year for its card on the overview. */
    public static class YearSummary {
        private final int year;
        private final GroupStats overall;
        private final PersonalStats me;

        YearSummary(int year, GroupStats overall, PersonalStats me) {
            this.year = year;
            this.overall = overall;
            this.me = me;
        }

        public int getYear() { return year; }
        public GroupStats getOverall() { return overall; }
        public PersonalStats getMe() { return me; }
    }

    public static class Wrapped {
        private final int year;
        private GroupStats overall;
        private final List<GroupStats> locations = new ArrayList<>();
        private List<DuelRow> duel = new ArrayList<>();
        private PersonalStats me;

        Wrapped(int year) { this.year = year; }

        public int getYear() { return year; }
        public GroupStats getOverall() { return overall; }
        public List<GroupStats> getLocations() { return locations; }
        public PersonalStats getMe() { return me; }
        public List<DuelRow> getDuel() { return duel; }

        /** Locations with at least one order, the user's own location first. */
        public List<GroupStats> getActiveLocations() {
            return locations.stream().filter(g -> !g.isEmpty()).collect(Collectors.toList());
        }
    }

    /** Figures for a group of orders: one location, or all of them. */
    public static class GroupStats {
        private final String name;
        private int orderCount;
        private int dishCount;
        private int peopleCount;
        private BigDecimal totalPaid = BigDecimal.ZERO;
        private BigDecimal tipTotal = BigDecimal.ZERO;
        private BigDecimal avgTip;
        private BigDecimal tipPercent;
        private List<Ranked> topProducts = new ArrayList<>();
        private Ranked topRestaurant;
        private Ranked busiestWeekday;
        private Ranked busiestMonth;
        private FoodOrder biggestOrder;
        private int biggestOrderPeople;

        GroupStats(String name) { this.name = name; }

        public String getName() { return name; }
        public boolean isEmpty() { return orderCount == 0; }
        public int getOrderCount() { return orderCount; }
        /** Sum of all item quantities (cost splits have no items). */
        public int getDishCount() { return dishCount; }
        /** Distinct people who took part in at least one order. */
        public int getPeopleCount() { return peopleCount; }
        /** Items plus tip of item orders, plus the totals of cost splits. */
        public BigDecimal getTotalPaid() { return totalPaid; }
        public BigDecimal getTipTotal() { return tipTotal; }
        /** Tip per item order (orders without tip included); null without item orders. */
        public BigDecimal getAvgTip() { return avgTip; }
        /** Tip relative to the item value of item orders, in percent; null without items. */
        public BigDecimal getTipPercent() { return tipPercent; }
        public List<Ranked> getTopProducts() { return topProducts; }
        public Ranked getTopProduct() { return topProducts.isEmpty() ? null : topProducts.get(0); }
        public List<Ranked> getRunnerUpProducts() {
            return topProducts.size() > 1 ? topProducts.subList(1, topProducts.size()) : List.of();
        }
        public Ranked getTopRestaurant() { return topRestaurant; }
        public Ranked getBusiestWeekday() { return busiestWeekday; }
        public Ranked getBusiestMonth() { return busiestMonth; }
        /** Order with the most participants (the earlier one on a tie). */
        public FoodOrder getBiggestOrder() { return biggestOrder; }
        public int getBiggestOrderPeople() { return biggestOrderPeople; }
    }

    /** Figures for the logged-in user. */
    public static class PersonalStats {
        private final String name;
        private int orderCount;
        private int dishCount;
        private int costSplitCount;
        private int ordersOrganised;
        private int paidUpfrontCount;
        private BigDecimal paidUpfrontAmount = BigDecimal.ZERO;
        private BigDecimal spent = BigDecimal.ZERO;
        private BigDecimal avgPerOrder;
        private BigDecimal tipGiven = BigDecimal.ZERO;
        private List<Ranked> topItems = new ArrayList<>();
        private Ranked favouriteRestaurant;
        private Ranked favouriteWeekday;
        private Ranked busiestMonth;
        private FoodOrder firstOrder;
        private FoodOrder lastOrder;
        private FoodOrder biggestOrder;
        private BigDecimal biggestOrderAmount = BigDecimal.ZERO;
        private int rank;
        private int rankOf;
        private FoodOrder.Location homeLocation;

        PersonalStats(String name) { this.name = name; }

        public String getName() { return name; }
        public boolean isEmpty() { return orderCount == 0; }
        public int getOrderCount() { return orderCount; }
        public int getDishCount() { return dishCount; }
        public int getCostSplitCount() { return costSplitCount; }
        /** Counted orders the user created (whether or not they ate along). */
        public int getOrdersOrganised() { return ordersOrganised; }
        /** Counted orders the user advanced the money for ("Paid by", else creator). */
        public int getPaidUpfrontCount() { return paidUpfrontCount; }
        public BigDecimal getPaidUpfrontAmount() { return paidUpfrontAmount; }
        /** Own items plus tip share or cost share, paid or not. */
        public BigDecimal getSpent() { return spent; }
        public BigDecimal getAvgPerOrder() { return avgPerOrder; }
        public BigDecimal getTipGiven() { return tipGiven; }
        public List<Ranked> getTopItems() { return topItems; }
        public Ranked getTopItem() { return topItems.isEmpty() ? null : topItems.get(0); }
        public List<Ranked> getRunnerUpItems() {
            return topItems.size() > 1 ? topItems.subList(1, topItems.size()) : List.of();
        }
        public Ranked getFavouriteRestaurant() { return favouriteRestaurant; }
        public Ranked getFavouriteWeekday() { return favouriteWeekday; }
        public Ranked getBusiestMonth() { return busiestMonth; }
        public FoodOrder getFirstOrder() { return firstOrder; }
        public FoodOrder getLastOrder() { return lastOrder; }
        public FoodOrder getBiggestOrder() { return biggestOrder; }
        public BigDecimal getBiggestOrderAmount() { return biggestOrderAmount; }
        /** Place by number of orders among everyone who ordered that year (1 = most). */
        public int getRank() { return rank; }
        public int getRankOf() { return rankOf; }
        /** The ranking is only shown to people in the top three or the top half. */
        public boolean isRankShown() { return rank > 0 && rankOf > 1 && (rank <= 3 || rank * 2 <= rankOf); }
        public FoodOrder.Location getHomeLocation() { return homeLocation; }
    }

    /** A name with how often it came up, e.g. a dish and the restaurant it mostly came from. */
    public static class Ranked {
        private final String name;
        private final long count;
        private final String detail;

        Ranked(String name, long count, String detail) {
            this.name = name;
            this.count = count;
            this.detail = detail;
        }

        public String getName() { return name; }
        public long getCount() { return count; }
        public String getDetail() { return detail; }
    }

    /** One line of the location comparison; leader is the index of the highest value, -1 on a tie. */
    public static class DuelRow {
        private final String label;
        private final boolean money;
        private final List<BigDecimal> values;
        private final int leader;

        DuelRow(String label, boolean money, List<BigDecimal> values) {
            this.label = label;
            this.money = money;
            this.values = values;
            BigDecimal max = values.stream().filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
            long atMax = max == null ? 0 : values.stream().filter(v -> v != null && v.compareTo(max) == 0).count();
            this.leader = atMax == 1 ? indexOfValue(values, max) : -1;
        }

        private static int indexOfValue(List<BigDecimal> values, BigDecimal value) {
            for (int i = 0; i < values.size(); i++) {
                if (values.get(i) != null && values.get(i).compareTo(value) == 0) return i;
            }
            return -1;
        }

        public String getLabel() { return label; }
        public boolean isMoney() { return money; }
        public List<BigDecimal> getValues() { return values; }
        public int getLeader() { return leader; }
    }
}
