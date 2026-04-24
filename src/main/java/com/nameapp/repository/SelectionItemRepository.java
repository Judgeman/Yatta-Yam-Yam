package com.nameapp.repository;

import com.nameapp.model.SelectionItem;
import com.nameapp.model.UserOrderSelection;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SelectionItemRepository extends JpaRepository<SelectionItem, Long> {
    List<SelectionItem> findBySelection(UserOrderSelection selection);
}
