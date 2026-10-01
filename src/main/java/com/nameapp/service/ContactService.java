package com.nameapp.service;

import com.nameapp.model.Contact;
import com.nameapp.model.FoodOrder;
import com.nameapp.repository.ContactRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class ContactService {

    private static final String UPLOAD_DIR = "uploads/";

    private final ContactRepository contactRepo;

    public ContactService(ContactRepository contactRepo) {
        this.contactRepo = contactRepo;
    }

    public List<Contact> getAllContacts() {
        return contactRepo.findAllByOrderByNameAsc();
    }

    public List<Contact> getContactsByLocation(FoodOrder.Location location) {
        return contactRepo.findByLocationOrderByNameAsc(location);
    }

    public Optional<Contact> findContact(Long id) {
        return contactRepo.findById(id);
    }

    public Contact saveContact(Contact contact, String name, FoodOrder.Location location,
                               String address, List<String> phoneNumbers,
                               String imageUrl, MultipartFile imageFile,
                               boolean removeImage) throws IOException {
        contact.setName(name.trim());
        contact.setLocation(location);
        contact.setAddress(address != null && !address.isBlank() ? address.trim() : null);

        contact.getPhoneNumbers().clear();
        if (phoneNumbers != null) {
            phoneNumbers.stream()
                    .filter(p -> p != null && !p.isBlank())
                    .map(String::trim)
                    .forEach(contact.getPhoneNumbers()::add);
        }

        // Handle image: a new upload wins, then the remove flag, then the URL
        if (imageFile != null && !imageFile.isEmpty()) {
            String filename = UUID.randomUUID() + "_" + imageFile.getOriginalFilename();
            Path uploadPath = Paths.get(UPLOAD_DIR);
            Files.createDirectories(uploadPath);
            Files.copy(imageFile.getInputStream(), uploadPath.resolve(filename),
                    StandardCopyOption.REPLACE_EXISTING);
            contact.setImageUrl("/uploads/" + filename);
        } else if (removeImage) {
            contact.setImageUrl(null);
        } else if (imageUrl != null && !imageUrl.isBlank()) {
            contact.setImageUrl(imageUrl.trim());
        }

        return contactRepo.save(contact);
    }

    public void deleteContact(Long id) {
        contactRepo.deleteById(id);
    }
}
