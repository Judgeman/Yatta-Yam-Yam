package com.nameapp.repository;

import com.nameapp.model.AppUser;
import com.nameapp.model.ItemList;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ItemListRepository extends JpaRepository<ItemList, Long> {
    List<ItemList> findByCreator(AppUser creator);
}
