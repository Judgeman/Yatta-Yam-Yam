package com.nameapp.service;

import com.nameapp.model.AppUser;
import com.nameapp.model.UserOrderSelection;
import com.nameapp.repository.AppUserRepository;
import com.nameapp.repository.UserOrderSelectionRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
public class AppUserService {

    private final AppUserRepository repository;
    private final UserOrderSelectionRepository selectionRepository;

    public AppUserService(AppUserRepository repository,
                          UserOrderSelectionRepository selectionRepository) {
        this.repository = repository;
        this.selectionRepository = selectionRepository;
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

    public java.util.Map<String, Object> getStatsForUser(AppUser user) {
        java.util.Map<String, Object> stats = new java.util.HashMap<>();

        List<UserOrderSelection> selections = selectionRepository.findByUser(user);

        long participated = selections.stream()
                .filter(s -> !s.getItems().isEmpty())
                .count();

        long openPayments = selections.stream()
                .filter(s -> !s.getItems().isEmpty()
                        && !s.isPaid()
                        && !s.isMarkedPaidByOwner()
                        && s.getOrder().getStatus() == com.nameapp.model.FoodOrder.OrderStatus.CLOSED)
                .count();

        BigDecimal openAmount = selections.stream()
                .filter(s -> !s.getItems().isEmpty()
                        && !s.isPaid()
                        && !s.isMarkedPaidByOwner()
                        && s.getOrder().getStatus() == com.nameapp.model.FoodOrder.OrderStatus.CLOSED)
                .map(s -> {
                    com.nameapp.model.FoodOrder order = s.getOrder();
                    List<com.nameapp.model.UserOrderSelection> orderSelections = selectionRepository.findByOrder(order);
                    long participantCount = orderSelections.stream()
                            .filter(os -> !os.getItems().isEmpty())
                            .count();
                    BigDecimal tip = (order.getTipAmount() != null && participantCount > 0)
                            ? order.getTipAmount().divide(
                            BigDecimal.valueOf(participantCount), 2, java.math.RoundingMode.HALF_UP)
                            : BigDecimal.ZERO;
                    return s.getSubtotal().add(tip);
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

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

    public List<java.util.Map<String, Object>> getAllUserStats() {
        return repository.findAll().stream().map(user -> {
                    java.util.Map<String, Object> stats = new java.util.HashMap<>();
                    List<com.nameapp.model.UserOrderSelection> selections = selectionRepository.findByUser(user);

                    long participated = selections.stream()
                            .filter(s -> !s.getItems().isEmpty())
                            .count();

                    java.math.BigDecimal totalSpent = selections.stream()
                            .filter(s -> !s.getItems().isEmpty()
                                    && (s.isPaid() || s.isMarkedPaidByOwner()))
                            .map(s -> {
                                com.nameapp.model.FoodOrder order = s.getOrder();
                                List<com.nameapp.model.UserOrderSelection> orderSelections =
                                        selectionRepository.findByOrder(order);
                                long count = orderSelections.stream()
                                        .filter(os -> !os.getItems().isEmpty()).count();
                                java.math.BigDecimal tip = (order.getTipAmount() != null && count > 0)
                                        ? order.getTipAmount().divide(java.math.BigDecimal.valueOf(count),
                                        2, java.math.RoundingMode.HALF_UP)
                                        : java.math.BigDecimal.ZERO;
                                return s.getSubtotal().add(tip);
                            })
                            .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

                    long openPayments = selections.stream()
                            .filter(s -> !s.getItems().isEmpty()
                                    && !s.isPaid()
                                    && !s.isMarkedPaidByOwner()
                                    && s.getOrder().getStatus() == com.nameapp.model.FoodOrder.OrderStatus.CLOSED)
                            .count();

                    java.math.BigDecimal openAmount = selections.stream()
                            .filter(s -> !s.getItems().isEmpty()
                                    && !s.isPaid()
                                    && !s.isMarkedPaidByOwner()
                                    && s.getOrder().getStatus() == com.nameapp.model.FoodOrder.OrderStatus.CLOSED)
                            .map(s -> {
                                com.nameapp.model.FoodOrder order = s.getOrder();
                                List<com.nameapp.model.UserOrderSelection> orderSelections =
                                        selectionRepository.findByOrder(order);
                                long count = orderSelections.stream()
                                        .filter(os -> !os.getItems().isEmpty()).count();
                                java.math.BigDecimal tip = (order.getTipAmount() != null && count > 0)
                                        ? order.getTipAmount().divide(java.math.BigDecimal.valueOf(count),
                                        2, java.math.RoundingMode.HALF_UP)
                                        : java.math.BigDecimal.ZERO;
                                return s.getSubtotal().add(tip);
                            })
                            .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

                    stats.put("name", user.getName());
                    stats.put("registeredAt", user.getRegisteredAt());
                    stats.put("participated", participated);
                    stats.put("totalSpent", totalSpent);
                    stats.put("openPayments", openPayments);
                    stats.put("openAmount", openAmount);
                    return stats;
                }).sorted((a, b) -> ((String) a.get("name")).compareToIgnoreCase((String) b.get("name")))
                .collect(java.util.stream.Collectors.toList());
    }
}
