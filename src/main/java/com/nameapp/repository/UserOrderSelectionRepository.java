package com.nameapp.repository;

import com.nameapp.model.AppUser;
import com.nameapp.model.FoodOrder;
import com.nameapp.model.UserOrderSelection;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserOrderSelectionRepository extends JpaRepository<UserOrderSelection, Long> {
    Optional<UserOrderSelection> findByOrderAndUser(FoodOrder order, AppUser user);
    List<UserOrderSelection> findByOrder(FoodOrder order);
    List<UserOrderSelection> findByUser(AppUser user);
    List<UserOrderSelection> findByUserAndOrder_Status(AppUser user, FoodOrder.OrderStatus status);
    // Paid by the participant or confirmed by the creator (payment calculator)
    List<UserOrderSelection> findByPaidTrueOrMarkedPaidByOwnerTrue();
    // Not paid yet in orders with the given status (payment calculator: unpaid amounts)
    List<UserOrderSelection> findByOrder_StatusAndPaidFalseAndMarkedPaidByOwnerFalse(FoodOrder.OrderStatus status);
}
