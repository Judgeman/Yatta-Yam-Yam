package com.nameapp.repository;

import com.nameapp.model.Item;
import com.nameapp.model.ItemList;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ItemRepository extends JpaRepository<Item, Long> {
    List<Item> findByItemList(ItemList itemList);
}
