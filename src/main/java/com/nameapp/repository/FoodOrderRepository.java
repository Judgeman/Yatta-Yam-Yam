package com.nameapp.repository;

import com.nameapp.model.AppUser;
import com.nameapp.model.FoodOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface FoodOrderRepository extends JpaRepository<FoodOrder, Long> {
    List<FoodOrder> findByStatusNotOrderByOrderDateDesc(FoodOrder.OrderStatus status);
    List<FoodOrder> findByStatusOrderByOrderDateDesc(FoodOrder.OrderStatus status);
    Optional<FoodOrder> findTopByCreatorOrderByOrderDateDesc(AppUser creator);
}
