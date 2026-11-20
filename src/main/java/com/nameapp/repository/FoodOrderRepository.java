package com.nameapp.repository;

import com.nameapp.model.AppUser;
import com.nameapp.model.FoodOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FoodOrderRepository extends JpaRepository<FoodOrder, Long> {
    List<FoodOrder> findByStatusNotOrderByOrderDateDesc(FoodOrder.OrderStatus status);
    List<FoodOrder> findByStatusOrderByOrderDateDesc(FoodOrder.OrderStatus status);
    Optional<FoodOrder> findTopByCreatorOrderByOrderDateDesc(AppUser creator);
    List<FoodOrder> findByStatusNotAndLocationOrderByOrderDateDesc(FoodOrder.OrderStatus status, FoodOrder.Location location);
    List<FoodOrder> findByStatusAndLocationOrderByOrderDateDesc(FoodOrder.OrderStatus status, FoodOrder.Location location);

    // Wrapped: orders of one year in the given states, oldest first
    List<FoodOrder> findByOrderDateBetweenAndStatusInOrderByOrderDateAscIdAsc(
            LocalDate from, LocalDate to, Collection<FoodOrder.OrderStatus> statuses);

    // Wrapped: whether a year has orders in the given states (for the January hint)
    boolean existsByOrderDateBetweenAndStatusIn(
            LocalDate from, LocalDate to, Collection<FoodOrder.OrderStatus> statuses);

    // Wrapped: dates of all orders in the given states (to list the years with data)
    @Query("select distinct o.orderDate from FoodOrder o where o.status in :statuses")
    List<LocalDate> findOrderDatesByStatusIn(@Param("statuses") Collection<FoodOrder.OrderStatus> statuses);
}
