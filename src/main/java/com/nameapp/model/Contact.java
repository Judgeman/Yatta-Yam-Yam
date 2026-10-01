package com.nameapp.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

// Phone book entry (e.g. a restaurant or delivery service) that can be
// looked up quickly while calling in an order.
@Entity
@Table(name = "contact")
public class Contact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "VARCHAR(255)")
    private FoodOrder.Location location;

    private String address;

    // Either a URL or a path to an uploaded file
    private String imageUrl;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "contact_phone_number", joinColumns = @JoinColumn(name = "contact_id"))
    @OrderColumn(name = "position")
    @Column(name = "phone_number", nullable = false)
    private List<String> phoneNumbers = new ArrayList<>();

    public Contact() {

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

    public FoodOrder.Location getLocation() {
        return location;
    }

    public void setLocation(FoodOrder.Location location) {
        this.location = location;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public List<String> getPhoneNumbers() {
        return phoneNumbers;
    }

    public void setPhoneNumbers(List<String> phoneNumbers) {
        this.phoneNumbers = phoneNumbers;
    }
}
