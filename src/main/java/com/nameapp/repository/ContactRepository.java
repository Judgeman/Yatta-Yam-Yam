package com.nameapp.repository;

import com.nameapp.model.Contact;
import com.nameapp.model.FoodOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ContactRepository extends JpaRepository<Contact, Long> {
    List<Contact> findAllByOrderByNameAsc();

    List<Contact> findByLocationOrderByNameAsc(FoodOrder.Location location);
}
