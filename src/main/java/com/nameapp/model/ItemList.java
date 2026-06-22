package com.nameapp.model;

import jakarta.persistence.*;
import org.hibernate.annotations.ColumnDefault;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "item_list")
public class ItemList {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_id")
    private AppUser creator;

    // Whether this list is offered when creating a new order.
    // Lists created by mistake can be hidden via the hidden item-list admin page.
    // The DB-level default keeps pre-existing lists visible when the column is added.
    @Column(nullable = false)
    @ColumnDefault("true")
    private boolean visible = true;

    @OneToMany(mappedBy = "itemList", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Item> items = new ArrayList<>();

    public ItemList() {

    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public AppUser getCreator() {
        return creator;
    }

    public void setCreator(AppUser creator) {
        this.creator = creator;
    }

    public List<Item> getItems() {
        return items;
    }

    public void setItems(List<Item> items) {
        this.items = items;
    }

    public boolean isVisible() {
        return visible;
    }

    public void setVisible(boolean visible) {
        this.visible = visible;
    }
}
