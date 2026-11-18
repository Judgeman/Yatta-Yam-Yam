package com.nameapp.service;

import com.nameapp.model.AppUser;
import com.nameapp.model.UserOrderSelection;
import com.nameapp.repository.AppUserRepository;
import com.nameapp.repository.UserOrderSelectionRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class AppUserService {

    private final AppUserRepository repository;
    private final UserOrderSelectionRepository selectionRepository;
    private final OrderService orderService;

    public AppUserService(AppUserRepository repository,
                          UserOrderSelectionRepository selectionRepository,
                          OrderService orderService) {
        this.repository = repository;
        this.selectionRepository = selectionRepository;
        this.orderService = orderService;
    }

    /**
     * Check if a user with this name already exists.
     */
    public Optional<AppUser> findByName(String name) {
        return repository.findByNameIgnoreCase(name.trim());
    }

    /**
     * Create a new user with the given name.
     * Throws if name is already taken.
     */
    public AppUser createUser(String name) {
        String trimmed = name.trim();
        if (repository.existsByNameIgnoreCase(trimmed)) {
            throw new IllegalArgumentException("Name already taken: " + trimmed);
        }
        return repository.save(new AppUser(trimmed));
    }

    public Map<String, Object> getStatsForUser(AppUser user) {
        Map<String, Object> stats = new HashMap<>();

        List<UserOrderSelection> selections = selectionRepository.findByUser(user);

        // Item orders with at least one item plus every cost split the user joined
        long participated = selections.stream()
                .filter(orderService::isParticipant)
                .count();

        // Same figures as the red badge next to the name in the navbar
        List<OrderService.OpenDebt> openDebts = orderService.getOpenDebts(user);
        long openPayments = openDebts.size();
        BigDecimal openAmount = OrderService.totalOf(openDebts);

        stats.put("registeredAt", user.getRegisteredAt());
        stats.put("participated", participated);
        stats.put("openPayments", openPayments);
        stats.put("openAmount", openAmount);
        return stats;
    }

    public AppUser renameUser(String oldName, String newName) {
        String trimmed = newName.trim();
        if (repository.existsByNameIgnoreCase(trimmed)) {
            throw new IllegalArgumentException("Name already taken: " + trimmed);
        }
        AppUser user = repository.findByNameIgnoreCase(oldName)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + oldName));
        user.setName(trimmed);
        return repository.save(user);
    }

    public List<Map<String, Object>> getAllUserStats() {
        return repository.findAll().stream().map(user -> {
                    Map<String, Object> stats = new HashMap<>();
                    List<UserOrderSelection> selections = selectionRepository.findByUser(user);

                    long participated = selections.stream()
                            .filter(orderService::isParticipant)
                            .count();

                    // Own items plus tip share (item orders) or cost share (cost splits)
                    BigDecimal totalSpent = selections.stream()
                            .filter(s -> orderService.isParticipant(s)
                                    && (s.isPaid() || s.isMarkedPaidByOwner()))
                            .map(s -> s.getSubtotal().add(orderService.getPerPersonCharge(s.getOrder())))
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    // Same figures as the overview and the red badge in the navbar
                    List<OrderService.OpenDebt> openDebts = orderService.getOpenDebts(user);

                    stats.put("name", user.getName());
                    stats.put("registeredAt", user.getRegisteredAt());
                    stats.put("participated", participated);
                    stats.put("totalSpent", totalSpent);
                    stats.put("openPayments", (long) openDebts.size());
                    stats.put("openAmount", OrderService.totalOf(openDebts));
                    return stats;
                }).sorted((a, b) -> ((String) a.get("name")).compareToIgnoreCase((String) b.get("name")))
                .collect(Collectors.toList());
    }
}
